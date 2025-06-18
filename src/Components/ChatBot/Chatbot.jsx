import React, { useState, useEffect, useRef, useCallback } from 'react'
import style from './Chatbot.module.css';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Sidebar from './Sidebar';
import { FaPaperclip, FaHistory, FaSpinner, FaFileAlt, FaCheckCircle, FaTimesCircle, FaEdit, FaCheck, FaTimes, FaCopy } from 'react-icons/fa';
import { FiArrowUp, FiGlobe, FiFile } from 'react-icons/fi';
import CyberBackgroundChatBot from './CyberBackgroundChatBot';
import FileSelector from './FileSelector';
import { getCurrentUserId } from '../../Utils/jwtUtils';

// Configure axios with base URL - using direct localhost calls like scanner
const API_BASE_URL = '/api'; // Use relative path instead of hardcoded localhost:3000
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Origin, Content-Type, Accept, Authorization, X-Request-With'
    },
    withCredentials: false
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('userToken');
    const userId = getCurrentUserId();
    
    // Add token to headers if available
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Add user_id to query params for GET requests
    if (config.method === 'get') {
        config.params = { ...config.params, user_id: userId };
    }
    
    // Add user_id to request body for POST/PUT requests
    if (['post', 'put'].includes(config.method) && config.data) {
        // Handle FormData separately
        if (config.data instanceof FormData) {
            config.data.append('user_id', userId);
        } else {
            // Handle JSON data
            config.data = { 
                ...(typeof config.data === 'string' ? JSON.parse(config.data) : config.data), 
                user_id: userId 
            };
        }
    }
    
    return config;
}, error => {
    return Promise.reject(error);
});

api.interceptors.response.use(
    response => response,
    error => {
        // Only logout on 401 (Unauthorized) errors, not on 404 or 422
        if (error.response?.status === 401) {
            localStorage.removeItem('userToken');
            window.location.href = '/signin';
        }
        return Promise.reject(error);
    }
);

export default function Chatbot() {
    const [conversationId, setConversationId] = useState(null);
    const [message, setMessage] = useState('');
    const [conversations, setConversations] = useState([]);
    const [currentConversation, setCurrentConversation] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const messageEndRef = useRef(null);
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [messages, setMessages] = useState([]);
    const [streamingResponse, setStreamingResponse] = useState('');
    const messageRefs = useRef([]);
    const [webSearchEnabled, setWebSearchEnabled] = useState(false);
    const [autoSearchActive, setAutoSearchActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [uploadedFileDisplay, setUploadedFileDisplay] = useState(null);
    const [editingMsgIdx, setEditingMsgIdx] = useState(null);
    const [editingMsgValue, setEditingMsgValue] = useState('');
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');
    const [pairVersionIdx, setPairVersionIdx] = useState({}); // {userMsgIndex: versionIndex}
    const fileInputRef = useRef(null);
    const [replyTo, setReplyTo] = useState(null);
    const [fileLocked, setFileLocked] = useState(false);
    // Track which message has a file attached to it
    const [fileAttachedToMessageIdx, setFileAttachedToMessageIdx] = useState(null);
    const [conversationsLoaded, setConversationsLoaded] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [showFileSelector, setShowFileSelector] = useState(false);
    const [previousFiles, setPreviousFiles] = useState([]);
    const [loadingPreviousFiles, setLoadingPreviousFiles] = useState(false);
    const location = useLocation();
    const [streamingProgress, setStreamingProgress] = useState(0);
    const [streamingError, setStreamingError] = useState(null);
    const abortControllerRef = useRef(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState(null);
    const [isCooldown, setIsCooldown] = useState(false);
    const cooldownTimeoutRef = useRef(null);
    const [conversationFiles, setConversationFiles] = useState([]);
    const [fileListMode, setFileListMode] = useState('all'); // 'all' or 'conversation'
    const [regeneratingResponse, setRegeneratingResponse] = useState(null); // Track which message is being regenerated
    const [handlingNavbarMessage, setHandlingNavbarMessage] = useState(false); // Track if we're processing a navbar message

    // Add duplicate prevention state
    const [processedMessageIds, setProcessedMessageIds] = useState(new Set());
    const [activeRequests, setActiveRequests] = useState(new Set());
    const lastMessageRef = useRef(null);
    const messageCountRef = useRef(0);

    // Generate unique message ID
    const generateMessageId = () => {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    // Enhanced duplicate detection function with web search and file handling
    const isDuplicateMessage = (newMessage, existingMessages) => {
        if (!newMessage || !newMessage.content) return false;
        
        // Enhanced content hash for better duplicate detection
        const contentHash = newMessage.content.length > 200 
            ? newMessage.content.substring(0, 100) + newMessage.content.substring(newMessage.content.length - 100)
            : newMessage.content;
        const messageKey = `${newMessage.role}_${contentHash}_${newMessage.file_id || 'no_file'}`;
        
        if (processedMessageIds.has(messageKey)) {
            console.log('🚫 Duplicate message detected by enhanced content hash:', messageKey);
            return true;
        }
        
        // More comprehensive duplicate check for recent messages (last 5 messages)
        const recentMessages = existingMessages.slice(-5);
        const isDuplicate = recentMessages.some(msg => {
            // Exact content match
            if (msg.role === newMessage.role && msg.content === newMessage.content) {
                // For file-related messages, also check file_id
                if (newMessage.file_id || msg.file_id) {
                    return msg.file_id === newMessage.file_id;
                }
                return true;
            }
            
            // For long messages (like vulnerability reports), check if content is substantially similar
            if (msg.role === newMessage.role && 
                msg.content.length > 500 && 
                newMessage.content.length > 500) {
                const similarity = calculateContentSimilarity(msg.content, newMessage.content);
                if (similarity > 0.95) {
                    console.log('🚫 Duplicate detected by content similarity:', similarity);
                    return true;
                }
            }
            
            return false;
        });
        
        if (isDuplicate) {
            console.log('🚫 Duplicate message detected by comprehensive comparison');
            return true;
        }
        
        // Check if this is the same as the last message we just added
        if (lastMessageRef.current && 
            lastMessageRef.current.role === newMessage.role &&
            lastMessageRef.current.content === newMessage.content) {
            console.log('🚫 Duplicate message detected by last message reference');
            return true;
        }
        
        return false;
    };

    // Helper function to calculate content similarity for long messages
    const calculateContentSimilarity = (content1, content2) => {
        if (content1 === content2) return 1.0;
        
        // Simple similarity check based on common words
        const words1 = content1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const words2 = content2.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        
        if (words1.length === 0 || words2.length === 0) return 0;
        
        const commonWords = words1.filter(word => words2.includes(word));
        const similarity = (commonWords.length * 2) / (words1.length + words2.length);
        
        return similarity;
    };

    // Enhanced message addition function with duplicate prevention
    const addMessageSafely = (newMessage, updateFunction = null) => {
        const messageId = newMessage.id || generateMessageId();
        const messageWithId = { ...newMessage, id: messageId };
        
        setMessages(prevMessages => {
            // Check for duplicates
            if (isDuplicateMessage(messageWithId, prevMessages)) {
                console.log('🚫 Preventing duplicate message addition');
                return prevMessages;
            }
            
            // Additional check: if this is an assistant message and the last message is also assistant with same content
            if (messageWithId.role === 'assistant' && prevMessages.length > 0) {
                const lastMsg = prevMessages[prevMessages.length - 1];
                if (lastMsg.role === 'assistant' && lastMsg.content === messageWithId.content) {
                    console.log('🚫 Preventing duplicate assistant message');
                    return prevMessages;
                }
            }
            
            // Track processed message
            const messageKey = `${messageWithId.role}_${messageWithId.content.substring(0, 100)}`;
            setProcessedMessageIds(prev => {
                const newSet = new Set(prev);
                newSet.add(messageKey);
                // Keep only last 10 processed messages to prevent memory leak
                if (newSet.size > 10) {
                    const firstKey = newSet.values().next().value;
                    newSet.delete(firstKey);
                }
                return newSet;
            });
            
            // Update last message reference
            lastMessageRef.current = messageWithId;
            messageCountRef.current = prevMessages.length + 1;
            
            console.log('✅ Adding new message safely:', messageWithId.role, messageWithId.content.substring(0, 50) + '...');
            
            if (updateFunction) {
                return updateFunction([...prevMessages, messageWithId]);
            }
            return [...prevMessages, messageWithId];
        });
    };

    // Enhanced request deduplication function
    const createRequestKey = (endpoint, payload) => {
        // Create a more specific key that includes important parameters
        const keyData = {
            endpoint,
            message: payload.message,
            file_id: payload.file_id,
            force_web_search: payload.force_web_search,
            conversationId: conversationId,
            timestamp: Math.floor(Date.now() / 1000) // Group requests within same second
        };
        return JSON.stringify(keyData);
    };

    const isRequestActive = (requestKey) => {
        return activeRequests.has(requestKey);
    };

    const addActiveRequest = (requestKey) => {
        setActiveRequests(prev => new Set([...prev, requestKey]));
    };

    const removeActiveRequest = (requestKey) => {
        setActiveRequests(prev => {
            const newSet = new Set(prev);
            newSet.delete(requestKey);
            return newSet;
        });
    };

    // Add request timeout to prevent stuck requests
    const addActiveRequestWithTimeout = (requestKey, timeoutMs = 30000) => {
        addActiveRequest(requestKey);
        
        // Auto-remove request after timeout
        setTimeout(() => {
            removeActiveRequest(requestKey);
            console.log('🕐 Request timeout, removing from active requests:', requestKey);
        }, timeoutMs);
    };

    // Clean up ?message=... from the URL on load
    useEffect(() => {
        if (location.pathname === '/chatbot' && location.search.startsWith('?message=')) {
            navigate('/chatbot', { replace: true });
        }
    }, [location, navigate]);

    // Define functions that need to be used by other functions
    const handleNewChat = async () => {
        try {
            const userId = getCurrentUserId();
            if (!userId) {
                navigate('/signin');
                return;
            }
            const response = await api.post('/conversations/new', { 
                title: 'New Conversation',
                user_id: userId 
            });
            const newConversation = response.data.conversation;
            setConversations(prev => sortConversations([newConversation, ...prev]));
            setConversationId(newConversation.id);
        } catch {
            // Suppress error
        }
    };

    const handleDeleteConversation = async (id) => {
        try {
            const userId = getCurrentUserId();
            if (!userId) {
                navigate('/signin');
                return;
            }
            await api.delete(`/conversations/${id}`, {
                data: { user_id: userId }
            });
            setConversations(prev => sortConversations(prev.filter(conv => conv.id !== id)));
            if (id === conversationId) {
                setMessages([]); // Clear messages immediately
                setCurrentConversation(null);
                if (conversations.length > 1) {
                    // Find the next conversation to select
                    const nextConv = conversations.find(conv => conv.id !== id);
                    if (nextConv) {
                        setConversationId(nextConv.id);
                    }
                } else {
                    // Create a new conversation if this was the last one
                    handleNewChat();
                }
            }
        } catch {
            // Suppress error
        }
    };

    const handleRenameConversation = async (id, newTitle) => {
        try {
            const userId = getCurrentUserId();
            if (!userId) {
                navigate('/signin');
                return;
            }
            
            const response = await api.put(`/conversations/${id}/rename`, { 
                title: newTitle,
                user_id: userId 
            });
            
            setConversations(prev => sortConversations(
                prev.map(conv =>
                    conv.id === id ? { ...conv, title: newTitle } : conv
                )
            ));
            
            if (id === conversationId && currentConversation) {
                setCurrentConversation({ ...currentConversation, title: newTitle });
            }
            return {}; // Success
        } catch (error) {
            const msg = extractRenameError(error) || '';
            if (msg) {
                return { error: msg };
            }
            return {};
        }
    };

    // --- API error handler helper ---
    function handleAuthError(err, navigate) {
        // Only treat 401 as authentication error that requires logout
        if (err.response?.status === 401) {
            localStorage.removeItem('userToken');
            navigate('/signin');
            return true;
        }
        return false;
    }

    // --- Conversation fetch ---
    const fetchConversations = useCallback(async () => {
        // Don't fetch conversations if there's a navbar message - let the navbar handler do it
        const searchParams = new URLSearchParams(location.search);
        const incomingMessage = searchParams.get('message');
        
        if (incomingMessage || handlingNavbarMessage) {
            console.log('🚫 Skipping fetchConversations due to navbar message');
            return;
        }
        
        try {
            setIsLoading(true);
            const userId = getCurrentUserId();
            if (!userId) {
                navigate('/signin');
                return;
            }
            const response = await api.get(`/conversations?user_id=${userId}`);
            const convs = response.data.conversations || [];
            setConversations(sortConversations(convs));
            setConversationsLoaded(true);
            setRetryCount(0);
        } catch (err) {
            if (handleAuthError(err, navigate)) return;
            console.error("Error fetching conversations:", err);
            if (retryCount < 3) {
                setTimeout(() => {
                    setRetryCount(prev => prev + 1);
                }, 500);
            }
        } finally {
            setIsLoading(false);
        }
    }, [retryCount, navigate, location.search, handlingNavbarMessage]);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // Retry mechanism
    useEffect(() => {
        if (retryCount > 0 && retryCount <= 3) {
            fetchConversations();
        }
    }, [retryCount, fetchConversations]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messageEndRef.current?.scrollIntoView();
    }, [currentConversation?.messages]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingResponse]);

    const scrollToBottom = () => {
        messageEndRef.current?.scrollIntoView();
    };

    // Scroll to a specific message index if requested
    useEffect(() => {
        if (window.location.hash.startsWith('#msg-')) {
            const idx = parseInt(window.location.hash.replace('#msg-', ''), 10);
            if (!isNaN(idx) && messageRefs.current[idx]) {
                messageRefs.current[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                messageRefs.current[idx].classList.add('ring-2', 'ring-yellow-400');
                setTimeout(() => {
                    messageRefs.current[idx]?.classList.remove('ring-2', 'ring-yellow-400');
                }, 2000);
            }
        }
    }, [messages]);

    // --- Fetch single conversation ---
    const fetchConversation = async () => {
        if (!conversationId) return;
        
        try {
            const userId = getCurrentUserId();
            if (!userId) {
                navigate('/signin');
                return;
            }
            
            const response = await axios.get(`/api/conversations/${conversationId}?user_id=${userId}`);
            
            if (response.data && response.data.conversation) {
                const conv = response.data.conversation;
                const serverMessages = conv.messages || [];
                
                // Enhanced message synchronization with duplicate prevention
                setMessages(prevMessages => {
                    // If we have no local messages, use server messages with IDs
                    if (prevMessages.length === 0) {
                        console.log('📝 No local messages, using server messages');
                        const messagesWithIds = serverMessages.map(msg => ({
                            ...msg,
                            id: msg.id || generateMessageId()
                        }));
                        return messagesWithIds;
                    }
                    
                    // If server has significantly more messages, update carefully
                    if (serverMessages.length > prevMessages.length + 1) {
                        console.log(`📝 Server has significantly more messages (${serverMessages.length} vs ${prevMessages.length}), updating`);
                        const messagesWithIds = serverMessages.map(msg => ({
                            ...msg,
                            id: msg.id || generateMessageId()
                        }));
                        return messagesWithIds;
                    }
                    
                    // If server has exactly one more message, check if it's different and not a duplicate
                    if (serverMessages.length === prevMessages.length + 1) {
                        const lastServerMsg = serverMessages[serverMessages.length - 1];
                        const lastLocalMsg = prevMessages[prevMessages.length - 1];
                        
                        // Only update if the new server message is different and not a duplicate
                        if (lastServerMsg && lastLocalMsg && 
                            lastServerMsg.role === 'assistant' && lastLocalMsg.role === 'user') {
                            
                            // Check if this assistant message is already in our local state
                            const isDuplicate = prevMessages.some(msg => 
                                msg.role === 'assistant' && 
                                msg.content === lastServerMsg.content
                            );
                            
                            if (!isDuplicate) {
                                console.log('📝 Server has new assistant response, updating');
                                const messagesWithIds = serverMessages.map(msg => ({
                                    ...msg,
                                    id: msg.id || generateMessageId()
                                }));
                                return messagesWithIds;
                            } else {
                                console.log('📝 Server message is duplicate, keeping local state');
                                return prevMessages;
                            }
                        }
                    }
                    
                    // If server has same number of messages, check for content differences
                    if (serverMessages.length === prevMessages.length) {
                        const hasContentDifferences = serverMessages.some((serverMsg, index) => {
                            const localMsg = prevMessages[index];
                            return !localMsg || 
                                   serverMsg.content !== localMsg.content || 
                                   serverMsg.role !== localMsg.role;
                        });
                        
                        if (hasContentDifferences) {
                            console.log('📝 Message content differs, updating from server');
                            const messagesWithIds = serverMessages.map(msg => ({
                                ...msg,
                                id: msg.id || generateMessageId()
                            }));
                            return messagesWithIds;
                        }
                    }
                    
                    console.log('📝 Local messages are up to date, keeping current state');
                    return prevMessages;
                });
                
                setCurrentConversation(conv);
                
                // Update this conversation in the conversations list
                setConversations(prevConvs => {
                    return sortConversations(prevConvs.map(c => 
                        c.id === conv.id ? {
                            ...c, 
                            title: conv.title,
                            updated_at: conv.updated_at,
                            message_count: (conv.messages || []).length
                        } : c
                    ));
                });
            }
        } catch (error) {
            if (handleAuthError(error, navigate)) return;
            console.error('Error fetching conversation:', error);
            setError('Failed to load conversation');
        }
    };

    // Utility: Only show error for duplicate conversation names
    const extractRenameError = (error) => {
        if (
            error?.response?.data?.msg &&
            error.response.data.msg.toLowerCase().includes('already exists')
        ) {
            return error.response.data.msg;
        }
        return '';
    };

    // Utility function to sort conversations newest to oldest
    const sortConversations = (convs) => {
        return [...convs].sort((a, b) => {
            const aTime = new Date(a.updated_at || a.created_at).getTime();
            const bTime = new Date(b.updated_at || b.created_at).getTime();
            return bTime - aTime;
        });
    };

    // Utility function for truncating reply context
    const getReplyPreview = (content, maxLen = 80) => {
        if (!content) return '';
        const singleLine = content.replace(/\s+/g, ' ').trim();
        return singleLine.length > maxLen ? singleLine.slice(0, maxLen) + '...' : singleLine;
    };

    // Helper function to copy message content to clipboard
    const copyToClipboard = async (content) => {
        try {
            await navigator.clipboard.writeText(content);
            // You could add a toast notification here if desired
            console.log('Content copied to clipboard');
        } catch (err) {
            console.error('Failed to copy content: ', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = content;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                console.log('Content copied to clipboard (fallback)');
            } catch (fallbackErr) {
                console.error('Fallback copy failed: ', fallbackErr);
            }
            document.body.removeChild(textArea);
        }
    };

    // Helper function to simulate streaming effect for specific message index
    const simulateStreamingEffect = async (content, targetIndex) => {
        if (!content || targetIndex === null || targetIndex === undefined) return;
        
        console.log('🎭 Simulating streaming effect for message index:', targetIndex, 'content:', content.substring(0, 50) + '...');
        
        // Update the specific message with streaming content
        const words = content.split(' ');
        
        for (let i = 0; i < words.length; i++) {
            const partial = words.slice(0, i + 1).join(' ');
            
            // Update the specific message in the messages array
            setMessages(prevMessages => {
                const newMessages = [...prevMessages];
                if (newMessages[targetIndex]) {
                    newMessages[targetIndex] = {
                        ...newMessages[targetIndex],
                        content: partial,
                        isStreaming: true
                    };
                }
                return newMessages;
            });
            
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        
        // Set final content and remove streaming flag
        setMessages(prevMessages => {
            const newMessages = [...prevMessages];
            if (newMessages[targetIndex]) {
                newMessages[targetIndex] = {
                    ...newMessages[targetIndex],
                    content: content,
                    isStreaming: false
                };
            }
            return newMessages;
        });
    };

    // Enhanced streaming handler with debugging
    const handleStreamingResponse = async (response, abortController = null) => {
        console.log('🔄 Starting streaming response...', response);
        
        if (!response || !response.body) {
            console.error('❌ No response body available');
            setIsLoading(false); // Make sure to clear loading state
            throw new Error('No response body available');
        }

        // Check if response is ok
        if (!response.ok) {
            console.error('❌ HTTP error:', response.status);
            setIsLoading(false); // Make sure to clear loading state
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log('✅ Response OK, getting reader...');
        const reader = response.body.getReader();
        let partial = '';
        let totalBytes = 0;
        let chunkCount = 0;
        const contentLength = response.headers.get('Content-Length');
        const expectedLength = contentLength ? parseInt(contentLength, 10) : null;

        console.log('📊 Content-Length:', expectedLength);

        // Reset streaming states
        setStreamingError(null);
        setStreamingProgress(0);

        try {
            console.log('🚀 Starting to read chunks...');
            while (true) {
                // Check if request was aborted
                if (abortController && abortController.signal.aborted) {
                    console.log('⏹️ Request was aborted');
                    throw new Error('Request was aborted');
                }

                const { value, done } = await reader.read();
                if (done) {
                    console.log('✅ Streaming complete!', { totalBytes, chunkCount });
                    break;
                }
                
                chunkCount++;
                totalBytes += value.length;
                
                console.log(`📦 Chunk ${chunkCount}: ${value.length} bytes`);
                
                // Update progress tracking
                if (expectedLength && expectedLength > 0) {
                    const progressPercent = Math.round((totalBytes / expectedLength) * 100);
                    setStreamingProgress(Math.min(progressPercent, 100));
                    console.log(`📈 Progress: ${progressPercent}%`);
                }
                
                // Decode and accumulate response
                const chunk = new TextDecoder('utf-8').decode(value, { stream: true });
                partial += chunk;
                
                console.log(`📝 Partial content length: ${partial.length}`);
                
                // Update streaming response state
                setStreamingResponse(partial);
                
                // Small delay to see the streaming effect
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // Check for web search usage
            const wasWebSearchUsed = response.headers.get('X-Web-Search-Used') === 'true';
            if (wasWebSearchUsed) {
                setAutoSearchActive(true);
                console.log('🌐 Web search was used');
            }

            return {
                content: partial,
                webSearchUsed: wasWebSearchUsed,
                totalBytes: totalBytes
            };

        } catch (error) {
            console.error('❌ Streaming error:', error);
            
            // Handle different types of errors
            if (error.name === 'AbortError' || error.message.includes('aborted')) {
                setStreamingError('Request was cancelled');
                console.log('⏹️ Streaming was aborted by user');
                return null;
            } else if (error.message.includes('network')) {
                setStreamingError('Network error during streaming. Please check your connection.');
            } else {
                setStreamingError('Error reading response: ' + error.message);
            }
            
            throw error;
        } finally {
            // Cleanup
            try {
                reader.releaseLock();
                console.log('🔓 Reader lock released');
            } catch (e) {
                console.warn('⚠️ Could not release reader lock:', e);
            }
            setStreamingProgress(0);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!message.trim() && !uploadedFile) return;
        if (isLoading) return;
        
        const userId = getCurrentUserId();
        if (!userId) {
            navigate('/signin');
            return;
        }
        
        // Create payload with user_id
        const payloadData = {
            user_id: userId,
            message: message.trim(),
            force_web_search: webSearchEnabled
        };
        
        if (replyTo) {
            payloadData.replyTo = replyTo;
        }
        
        if (uploadedFile) {
            payloadData.file_id = uploadedFile.file_id;
        }
        
        // Prevent duplicate submissions
        if (isLoading) {
            console.log('🚫 Preventing duplicate submission - already loading');
            return;
        }
        
        // Reset auto search indicator
        setAutoSearchActive(false);
        setReplyTo(null);

        // Build the user message with unique ID
        const userMessage = {
            id: generateMessageId(),
            role: 'user',
            content: message,
        };

        // Add reply context if available
        if (replyTo && replyTo.msg) {
            userMessage.replyTo = { 
                index: replyTo.index, 
                content: replyTo.msg.content 
            };
        }
        
        // Add the message to the messages array
        setMessages(prevMessages => {
            const newMessages = [...prevMessages, userMessage];
            return newMessages;
        });
        
        // Clear input and set loading state
        setMessage('');
        setIsLoading(true);
        setError('');
        
        // Create a unique request key
        const requestKey = createRequestKey('/chat', payloadData);
        
        try {
            // Add this request to active requests
            addActiveRequestWithTimeout(requestKey);
            
            // Make the API call
            const response = await api.post(`/chat/${conversationId}`, payloadData);
            
            // Handle response...
            // ... rest of the function remains the same ...
        } catch (error) {
            // ... error handling remains the same ...
        } finally {
            // ... cleanup remains the same ...
        }
    };

    // Improved file upload handler
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !validateFile(file)) return;
        
        const userId = getCurrentUserId();
        if (!userId) {
            navigate('/signin');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('conversation_id', conversationId);
        formData.append('user_id', userId);
        
        setUploadError('');
        setIsUploading(true);
        
        try {
            const response = await api.post('/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            if (response.data?.file_id) {
                setUploadedFile({
                    file_id: response.data.file_id,
                    filename: file.name,
                    filetype: response.data.filetype
                });
                setUploadedFileDisplay(file.name);
                setFileLocked(true);
            }
        } catch (error) {
            console.error('Upload error:', error);
            setUploadError('Failed to upload file. Please try again.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Add file validation
    const validateFile = (file) => {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = ['.txt', '.json', '.pdf', '.docx'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (file.size > maxSize) {
            return 'File size exceeds 10MB limit';
        }
        
        if (!allowedTypes.includes(fileExtension)) {
            return 'File type not supported. Please upload .txt, .json, .pdf, or .docx files';
        }
        
        return null;
    };

    // Update file input handler to include validation
    const handleFileInputChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const validationError = validateFile(file);
        if (validationError) {
            setUploadError(validationError);
            setUploadStatus(validationError);
            e.target.value = ''; // Clear the input
            return;
        }
        
        handleFileUpload(e);
    };

    const clearUploadedFile = () => {
        setUploadedFile(null);
        setUploadedFileDisplay(null);
        setUploadStatus('');
        setFileLocked(false);
    };

    // Custom renderer for code blocks in markdown
    const components = {
        code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
                <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                >
                    {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
            ) : (
                <code className={className} {...props}>
                    {children}
                </code>
            );
        },
        // Add custom renderers for links and paragraphs
        a({ node, children, href, ...props }) {
            // Check if this is a source link by looking at the text content
            const isSourceLink = React.Children.toArray(children).some(child => {
                if (typeof child === 'string') {
                    return child.match(/^\[\d+\]/);
                }
                return false;
            });

            return (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={isSourceLink
                        ? "text-blue-600 hover:underline font-bold text-lg block my-3 py-2"
                        : "text-blue-600 hover:underline"}
                    {...props}
                >
                    {children}
                </a>
            );
        },
        // Custom renderer for paragraphs to handle source lists
        p({ node, children, ...props }) {
            // Check if this paragraph contains "Sources:" text
            const childrenArray = React.Children.toArray(children);
            const text = childrenArray.map(child =>
                typeof child === 'string' ? child : ''
            ).join('');

            if (text.includes('Sources:')) {
                // This is a sources paragraph, let's format it specially
                const sourcesIndex = text.indexOf('Sources:');
                const beforeSources = text.substring(0, sourcesIndex + 8); // +8 for "Sources:"

                // We now get the rest of the children, which should include Markdown links
                // that will be processed by the ReactMarkdown 'a' renderer
                const sourcesContent = childrenArray.map(child => {
                    if (typeof child === 'string') {
                        // Only process the part after "Sources:"
                        if (child.includes('Sources:')) {
                            return child.substring(child.indexOf('Sources:') + 8);
                        }
                    }
                    return child;
                });

                return (
                    <div className="sources-section mt-3">
                        <p className="font-semibold">{beforeSources}</p>
                        <div className="mt-4 space-y-6">
                            {sourcesContent}
                        </div>
                    </div>
                );
            }

            return <p {...props}>{children}</p>;
        }
    };

    // Improved message editing with validation
    const handleEditSubmit = async (index, prevMessages = null) => {
        if (!editingMsgValue.trim()) {
            setEditError('Message cannot be empty');
            return;
        }
        if (editingMsgValue.length > 4000) {
            setEditError('Message is too long (max 4000 characters)');
            return;
        }
        
        const userId = getCurrentUserId();
        if (!userId) {
            navigate('/signin');
            return;
        }
        
        const originalMessage = messages[index];
        if (originalMessage.content === editingMsgValue.trim()) {
            setEditingMsgIdx(null);
            setEditingMsgValue('');
            return;
        }
        setEditLoading(true);
        setEditError('');
        try {
            const response = await api.put(
                `/conversations/${conversationId}/messages/${index}/edit`,
                {
                    content: editingMsgValue.trim(),
                    original_content: originalMessage.content,
                    user_id: userId
                },
            );
            if (response.data && response.data.conversation) {
                setCurrentConversation(response.data.conversation);
                setMessages(response.data.conversation.messages || []);
                setEditingMsgIdx(null);
                setEditingMsgValue('');
                setPairVersionIdx({});
                setUploadStatus('Message edited successfully');
                setTimeout(() => setUploadStatus(''), 3000);

                // --- Show streaming effect for the new assistant response ---
                const assistantMsgIndex = index + 1;
                if (response.data.conversation.messages[assistantMsgIndex] && 
                    response.data.conversation.messages[assistantMsgIndex].role === 'assistant') {
                    
                    const assistantContent = response.data.conversation.messages[assistantMsgIndex].content;
                    console.log('🎬 Starting streaming effect for edited message response');
                    
                    // First show loading state for the assistant message
                    setRegeneratingResponse(assistantMsgIndex);
                    
                    // Small delay to show loading state
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                    // Clear loading state and start streaming
                    setRegeneratingResponse(null);
                    await simulateStreamingEffect(assistantContent, assistantMsgIndex);
                }
                // --- End streaming effect ---
            }
        } catch (err) {
            if (handleAuthError(err, navigate)) return;
            // Rollback optimistic update if error
            if (prevMessages) setMessages(prevMessages);
            if (err.response?.status === 409) {
                setEditError('Message was modified by another user. Please refresh and try again.');
            } else if (err.response?.status === 403) {
                setEditError('You do not have permission to edit this message.');
            } else {
                setEditError(err?.response?.data?.msg || 'Failed to edit message. Please try again.');
            }
        } finally {
            setEditLoading(false);
        }
    };

    // Add message edit validation
    const validateEditMessage = (content) => {
        if (!content.trim()) {
            return 'Message cannot be empty';
        }
        if (content.length > 4000) {
            return 'Message is too long (max 4000 characters)';
        }
        return null;
    };

    // Update message edit input handler
    const handleEditInputChange = (e) => {
        const newValue = e.target.value;
        const validationError = validateEditMessage(newValue);
        
        if (validationError) {
            setEditError(validationError);
        } else {
            setEditError('');
        }
        
        setEditingMsgValue(newValue);
    };

    // Version toggle handler for user+assistant pair
    const handlePairVersionToggle = (userMsgIdx, direction) => {
        setPairVersionIdx(prev => {
            const msg = messages[userMsgIdx];
            const versions = msg && msg.versions ? msg.versions.length : 0;
            let current = prev[userMsgIdx] || 0;
            let next = current + direction;
            
            // Ensure next is within bounds (0 to total versions)
            if (next < 0) next = 0;
            if (next > versions) next = versions;
            
            return { ...prev, [userMsgIdx]: next };
        });
    };

    // Submit a selected version and get new AI response
    const handleSubmitVersion = async (msgIndex, versionIndex) => {
        if (!conversationId || isLoading) return;
        
        const msg = messages[msgIndex];
        if (!msg || !msg.versions || versionIndex <= 0) return;
        
        const userId = getCurrentUserId();
        if (!userId) {
            navigate('/signin');
            return;
        }
        
        // Get the version content (versionIndex - 1 because versionIndex=1 means first version)
        const versionContent = msg.versions[versionIndex - 1]?.content;
        if (!versionContent) return;
        
        // Track which assistant response is being regenerated
        const assistantMsgIndex = msgIndex + 1;
        setRegeneratingResponse(assistantMsgIndex);
        setError('');
        
        try {
            const token = localStorage.getItem('userToken');
            const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages/${msgIndex}/edit`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                credentials: 'same-origin',
                mode: 'cors',
                body: JSON.stringify({
                    content: versionContent,
                    original_content: msg.content,
                    user_id: userId
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.conversation) {
                // Update the conversation with new messages
                setMessages(data.conversation.messages || []);
                setCurrentConversation(data.conversation);
                
                // --- Show streaming effect for the new assistant response ---
                const newAssistantMsgIndex = msgIndex + 1;
                if (data.conversation.messages[newAssistantMsgIndex] && 
                    data.conversation.messages[newAssistantMsgIndex].role === 'assistant') {
                    
                    const assistantContent = data.conversation.messages[newAssistantMsgIndex].content;
                    console.log('🎬 Starting streaming effect for version submission response');
                    
                    // Small delay to show loading state (regeneratingResponse is already set)
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                    // Clear loading state and start streaming
                    setRegeneratingResponse(null);
                    await simulateStreamingEffect(assistantContent, newAssistantMsgIndex);
                }
                // --- End streaming effect ---
                
                // Reset version selection since we've now submitted this version as current
                setPairVersionIdx(prev => ({ ...prev, [msgIndex]: 0 }));
                
                // Update conversations list
                setConversations(prevConvs => {
                    return sortConversations(prevConvs.map(c =>
                        c.id === data.conversation.id ? {
                            ...c,
                            title: data.conversation.title,
                            updated_at: data.conversation.updated_at,
                            message_count: (data.conversation.messages || []).length
                        } : c
                    ));
                });
            }
        } catch (err) {
            if (handleAuthError(err, navigate)) return;
            setError('Failed to submit version. Please try again.');
            console.error('Error submitting version:', err);
        } finally {
            setRegeneratingResponse(null);
        }
    };

    // Helper to get the displayed content for a user+assistant pair version
    const getPairDisplayedContent = (msg, idx, isAssistant) => {
        // If this message is currently streaming, show the streaming content
        if (msg.isStreaming && msg.content) {
            return msg.content;
        }
        
        const vIdx = pairVersionIdx[idx] || 0;
        if (msg.versions && msg.versions.length && vIdx > 0) {
            // vIdx = 1 means first version, vIdx = 2 means second version, etc.
            // versions[0] is the oldest, versions[length-1] is newest
            const versionIndex = vIdx - 1; // Convert to 0-based index
            const version = msg.versions[versionIndex];
            return version ? version.content : msg.content;
        }
        return msg.content; // vIdx = 0 means current/latest content
    };

    // Modified message input handler for textarea
    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    // Restore and update the fetch conversation effect for when conversationId changes
    useEffect(() => {
        if (!conversationId) return;
        
        // Don't fetch if we're handling a navbar message
        if (handlingNavbarMessage) {
            console.log('🚫 Skipping conversation fetch due to navbar message handling');
            return;
        }
        
        // Don't clear messages or conversation immediately to prevent blinking
        // setMessages([]);
        // setCurrentConversation(null);

        const fetchCurrentConversation = async () => {
            if (!conversationId) return;
            try {
                const response = await api.get(`/conversations/${conversationId}`);

                if (response.data && response.data.conversation) {
                    const conv = response.data.conversation;
                    // Update messages array with the conversation's messages
                    let messages = conv.messages || [];
                    
                    // Set messages directly without clearing to prevent blinking
                    setMessages(messages);
                    // Update current conversation state
                    setCurrentConversation(conv);
                    // Update the conversation in the conversations list
                    setConversations(prevConvs => {
                        return sortConversations(prevConvs.map(c =>
                        c.id === conv.id ? {
                            ...c,
                            title: conv.title,
                            updated_at: conv.updated_at,
                            message_count: (conv.messages || []).length
                        } : c
                        ));
                    });
                }
            } catch (error) {
                console.error('Error fetching conversation:', error);
                if (error.response?.status === 404) {
                    // If conversation not found, create a new one
                    handleNewChat();
                } else {
                    setError('Failed to fetch conversation. Please try again.');
                }
            }
        };

        fetchCurrentConversation();
    }, [conversationId, handlingNavbarMessage]);

    // Restore the effect for ensuring new users have a conversation
    useEffect(() => {
        const createNewConversationIfNeeded = async () => {
            // Check if there's a navbar message parameter - if so, don't create empty conversation
            const searchParams = new URLSearchParams(location.search);
            const incomingMessage = searchParams.get('message');
            
            console.log('🔄 createNewConversationIfNeeded:', {
                conversationId,
                conversationsLength: conversations.length,
                incomingMessage: !!incomingMessage,
                shouldCreateConversation: !conversationId && conversations.length === 0 && !incomingMessage
            });
            
            if (!conversationId && conversations.length === 0 && !incomingMessage) {
                console.log('✅ Creating new conversation for user with no conversations and no navbar message');
                try {
                    const response = await api.post(
                        '/conversations/new',
                        { title: 'New Conversation' },
                    );

                    if (response.data && response.data.conversation) {
                        const newConversation = response.data.conversation;
                        // Add the new conversation to the list
                        setConversations(prev => sortConversations([newConversation, ...prev]));
                        // Set the new conversation ID in state
                        setConversationId(newConversation.id);
                    }
                } catch (error) {
                    console.error('Error creating new conversation:', error);
                    if (error.response?.status === 404) {
                        setError('User not found. Please log in again.');
                    } else {
                        setError('Failed to create new conversation. Please try again.');
                    }
                }
            } else if (!conversationId && conversations.length > 0 && !incomingMessage) {
                // If no conversation is selected but we have conversations, set the first one
                // Don't do this if there's an incoming navbar message
                console.log('✅ Selecting first existing conversation');
                setConversationId(conversations[0].id);
            } else {
                console.log('🚫 Skipping conversation creation:', {
                    reason: incomingMessage ? 'navbar message present' : 
                           conversationId ? 'conversation already selected' : 
                           'conversations exist'
                });
            }
        };

        // Only run this effect if conversations have been loaded and we're not handling a navbar message
        if (conversationsLoaded && !handlingNavbarMessage) {
            createNewConversationIfNeeded();
        }
    }, [conversationId, conversations, location.search, conversationsLoaded, handlingNavbarMessage]);

    // Add function to fetch previously uploaded files
    const fetchPreviousFiles = useCallback(async () => {
        try {
            setLoadingPreviousFiles(true);
            const response = await api.get('/user/files');
            if (response.data && response.data.files) {
                setPreviousFiles(response.data.files);
            }
        } catch (error) {
            console.error('Error fetching previous files:', error);
        } finally {
            setLoadingPreviousFiles(false);
        }
    }, []);

    // Update the select previous file function to provide better feedback
    const selectPreviousFile = async (fileId, fileName) => {
        try {
            setUploading(true);
            setUploadStatus('Loading previously uploaded file...');
            const response = await api.get(`/file/${fileId}`);
            if (response.data) {
                const fileData = response.data;
                const fileObj = {
                    file_id: fileId,
                    name: fileName,
                    display_name: fileData.filename || fileName,
                    content: fileData.content,
                    content_truncated: fileData.content_truncated,
                    metadata: fileData.metadata
                };
                setUploadedFile(fileObj);
                setUploadedFileDisplay(fileData.filename || fileName);
                setUploadStatus('File selected successfully');
                setFileLocked(false);
            }
        } catch (err) {
            if (handleAuthError(err, navigate)) return;
            setUploadStatus('Error selecting file: ' + (err.response?.data?.msg || err.message));
            setUploadedFile(null);
            setUploadedFileDisplay(null);
        } finally {
            setUploading(false);
            setShowFileSelector(false);
        }
    };

    // Fetch files for the current conversation
    const fetchConversationFiles = useCallback(async () => {
        if (!conversationId) return;
        try {
            setLoadingPreviousFiles(true);
            const response = await api.get(`/upload/filename/${conversationId}`);
            if (response.data && response.data.files) {
                setConversationFiles(response.data.files);
            }
        } catch (error) {
            setConversationFiles([]);
        } finally {
            setLoadingPreviousFiles(false);
        }
    }, [conversationId]);

    // Update effect to fetch files when file selector is opened or conversation changes
    useEffect(() => {
        if (showFileSelector) {
            if (fileListMode === 'all') {
                fetchPreviousFiles();
            } else {
                fetchConversationFiles();
            }
        }
    }, [showFileSelector, fileListMode, fetchPreviousFiles, fetchConversationFiles]);

    // Handle incoming message from navbar
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const incomingMessage = searchParams.get('message');
        
        if (incomingMessage) {
            console.log('🚀 Navbar message detected:', incomingMessage);
            setHandlingNavbarMessage(true); // Prevent other effects from interfering
            
            const sendInitialMessage = async () => {
                setMessage("");
                console.log('🔧 Setting loading to true for navbar message');
                setIsLoading(true);
                setError("");
                let convId = null;
                
                // Set a timeout to clear loading state if request takes too long
                const loadingTimeout = setTimeout(() => {
                    console.log('⏱️ Loading timeout reached, clearing loading state');
                    setIsLoading(false);
                    setError('Request timed out. Please try again.');
                }, 30000); // 30 second timeout
                try {
                    // Always fetch the latest conversations from backend
                    const response = await api.get('/conversations');
                    let userConvs = sortConversations(response.data.conversations || []);
                    setConversations(userConvs);
                    setConversationsLoaded(true); // Mark as loaded to prevent other effects from creating conversations

                    console.log('📋 Fetched conversations for navbar message:', userConvs.length);

                    // For navbar messages, prefer conversations with existing messages
                    // If no conversations exist or all conversations are empty, create a new one
                    const conversationsWithMessages = userConvs.filter(conv => 
                        (conv.messages && conv.messages.length > 0) || 
                        (conv.message_count && conv.message_count > 0)
                    );

                    console.log('📋 Conversations with messages:', conversationsWithMessages.length);

                    if (conversationsWithMessages.length > 0) {
                        // Use the most recent conversation that has messages
                        convId = conversationsWithMessages[0].id;
                        console.log('✅ Using existing conversation with messages:', convId);
                        setConversationId(convId);
                        
                        // Load the existing conversation messages first
                        const convResponse = await api.get(`/conversations/${convId}`);
                        if (convResponse.data && convResponse.data.conversation) {
                            const existingMessages = convResponse.data.conversation.messages || [];
                            setCurrentConversation(convResponse.data.conversation);
                            
                            // Add the user message to existing messages safely
                            const userMessage = {
                                id: generateMessageId(),
                                role: 'user',
                                content: incomingMessage
                            };
                            console.log('📝 Adding navbar message to existing conversation with', existingMessages.length, 'messages');
                            
                            // Use safe message addition
                            setMessages(existingMessages);
                            addMessageSafely(userMessage);
                        }
                    } else {
                        // Create a new conversation for the navbar message
                        console.log('🆕 Creating new conversation for navbar message');
                        const createResp = await api.post('/conversations/new', { title: 'New Conversation' });
                        if (createResp.data && createResp.data.conversation) {
                            convId = createResp.data.conversation.id;
                            console.log('✅ Created new conversation:', convId);
                            setConversations(prev => sortConversations([createResp.data.conversation, ...prev]));
                            setConversationId(convId);
                            setCurrentConversation(createResp.data.conversation);
                            
                            // Add the user message to the new empty conversation safely
                            const userMessage = {
                                id: generateMessageId(),
                                role: 'user',
                                content: incomingMessage
                            };
                            console.log('📝 Adding navbar message to new conversation');
                            addMessageSafely(userMessage);
                        } else {
                            setError('Failed to create new conversation.');
                            setIsLoading(false);
                            return;
                        }
                    }
                    
                    // Send the message in the selected conversation
                    const payload = {
                        message: incomingMessage,
                        force_web_search: false,
                        replyTo: undefined,
                        file_id: null
                    };

                    try {
                        // Use streaming approach similar to handleSubmit
                        const token = localStorage.getItem('userToken');
                        const endpoint = `/api/chat/${convId}`;
                        
                        console.log('🚀 Sending navbar message with streaming support');
                        
                        // Create abort controller for this request
                        const abortController = new AbortController();
                        abortControllerRef.current = abortController;

                        const response = await fetch(endpoint, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`,
                                'Accept': 'text/plain, application/json, text/event-stream, application/octet-stream'
                            },
                            credentials: 'same-origin',
                            mode: 'cors',
                            body: JSON.stringify(payload),
                            signal: abortController.signal
                        });

                        console.log('📥 Navbar response received:', response.status, response.headers.get('content-type'));
                        
                        // Check if this is a web search response (navbar messages are always regular chat, not web search)
                        const isWebSearchResponse = response.headers.get('X-Web-Search-Used') === 'true';
                        
                        // Check if the response is streaming
                        const contentType = response.headers.get('content-type') || '';
                        console.log('📋 Content-Type:', contentType);
                        console.log('🌐 Is Navbar Web Search Response:', isWebSearchResponse);
                        
                        if (!isWebSearchResponse && (contentType.includes('text/plain') || contentType.includes('text/event-stream') || contentType.includes('application/octet-stream'))) {
                            // Use the enhanced streaming handler for non-web-search responses
                            console.log('🔄 Using streaming for navbar message...');
                            try {
                                const streamResult = await handleStreamingResponse(response, abortController);
                                
                                // Handle abort case
                                if (streamResult === null) {
                                    setIsLoading(false); // Make sure to clear loading state even if aborted
                                    return; // Request was aborted
                                }
                                
                                // Add the streamed response to messages safely
                                if (streamResult && streamResult.content && streamResult.content.trim()) {
                                    const assistantMessage = {
                                        id: generateMessageId(),
                                        role: 'assistant',
                                        content: streamResult.content.trim(),
                                        isNavbarResponse: true, // Flag for navbar responses
                                        isStreamedResponse: true,
                                        timestamp: Date.now()
                                    };
                                    
                                    // Use safe message addition with duplicate prevention
                                    addMessageSafely(assistantMessage);
                                }
                            } catch (streamError) {
                                console.error('Error in navbar streaming:', streamError);
                                setError('Failed to process response. Please try again.');
                            } finally {
                                // Always clear loading and streaming states
                                console.log('🔧 Navbar streaming complete - clearing loading state');
                                setIsLoading(false);
                                setStreamingResponse('');
                            }
                            
                        } else if (isWebSearchResponse && contentType.includes('text/plain')) {
                            // Handle navbar web search response as non-streaming (read all at once)
                            console.log('🌐 Handling navbar web search response as non-streaming...');
                            const reader = response.body.getReader();
                            let fullContent = '';
                            
                            try {
                                while (true) {
                                    const { value, done } = await reader.read();
                                    if (done) break;
                                    
                                    const chunk = new TextDecoder('utf-8').decode(value, { stream: true });
                                    fullContent += chunk;
                                }
                                
                                // Set auto search indicator
                                setAutoSearchActive(true);
                                
                                // Add the complete response to messages safely
                                if (fullContent && fullContent.trim()) {
                                    const assistantMessage = {
                                        id: generateMessageId(),
                                        role: 'assistant',
                                        content: fullContent.trim(),
                                        isNavbarResponse: true, // Flag for navbar responses
                                        isWebSearchResponse: true,
                                        timestamp: Date.now()
                                    };
                                    
                                    // Use safe message addition with duplicate prevention
                                    addMessageSafely(assistantMessage);
                                }
                                
                                // Clear loading and streaming states
                                console.log('🔧 Navbar web search complete - clearing loading state');
                                setIsLoading(false);
                                setStreamingResponse('');
                                
                            } catch (error) {
                                console.error('Error reading navbar web search response:', error);
                                setError('Failed to read web search response. Please try again.');
                                setIsLoading(false);
                            } finally {
                                try {
                                    reader.releaseLock();
                                } catch (e) {
                                    console.warn('Could not release reader lock:', e);
                                }
                            }
                            
                        } else {
                            // Handle non-streaming response (JSON)
                            console.log('📄 Non-streaming response detected for navbar message');
                            try {
                                const responseData = await response.json();
                                console.log('📋 Response data:', responseData);
                                
                                // If we have message content, show it as if it was streamed
                                if (responseData.message || responseData.content) {
                                    const content = responseData.message || responseData.content;
                                    console.log('💬 Got content:', content);
                                    
                                    // Simulate streaming effect for non-streaming responses
                                    setStreamingResponse('');
                                    const words = content.split(' ');
                                    for (let i = 0; i < words.length; i++) {
                                        const partial = words.slice(0, i + 1).join(' ');
                                        setStreamingResponse(partial);
                                        await new Promise(resolve => setTimeout(resolve, 50));
                                    }
                                    
                                    // Add the response to messages safely
                                    const assistantMessage = {
                                        id: generateMessageId(),
                                        role: 'assistant',
                                        content: content.trim(),
                                        isNavbarResponse: true, // Flag for navbar responses
                                        isJSONResponse: true,
                                        timestamp: Date.now()
                                    };
                                    
                                    // Use safe message addition with duplicate prevention
                                    addMessageSafely(assistantMessage);
                                    // Clear loading and streaming states
                                    console.log('🔧 Navbar non-streaming complete - clearing loading state');
                                    setIsLoading(false);
                                    setStreamingResponse(''); // Clear after adding to messages
                                } else {
                                    // No content found in response
                                    console.error('No content found in response data:', responseData);
                                    setError('No response content received. Please try again.');
                                    setIsLoading(false);
                                }
                            } catch (jsonError) {
                                console.error('Error parsing JSON response:', jsonError);
                                setError('Failed to parse response. Please try again.');
                                setIsLoading(false);
                            }
                        }
                        
                        // Note: No need to fetch conversation again since we've already loaded it above
                        console.log('🔄 Navbar message successfully sent');
                        
                    } catch (apiError) {
                        // Handle different types of errors
                        if (apiError.name === 'AbortError' || apiError.message.includes('aborted')) {
                            console.log('Navbar message sending was cancelled');
                            setIsLoading(false); // Clear loading on abort
                            return;
                        }
                        
                        console.error('Error sending navbar message:', apiError);
                        
                        // Clear loading state on error
                        setIsLoading(false);
                        
                        // Set appropriate error messages - be more lenient with navbar messages
                        if (apiError.message.includes('Failed to fetch') || apiError.message.includes('network')) {
                            setError('Network error. Please check your connection and try again.');
                        } else if (apiError.response?.status === 401) {
                            // Only logout on explicit 401 responses, not on other errors
                            setError('Authentication error. Please sign in again.');
                            localStorage.removeItem('userToken');
                            navigate('/signin');
                        } else {
                            // For other errors, just show a generic message without logging out
                            setError('Failed to send message. Please try again.');
                            console.log('Detailed error:', apiError);
                        }
                    }

                    setWebSearchEnabled(false);
                    setReplyTo(null);
                    setUploadedFile(null);
                    setUploadedFileDisplay(null);
                    setFileLocked(false);
                } catch (err) {
                    console.error('Error sending message:', err);
                    setIsLoading(false); // Clear loading on error
                    if (err.response?.status === 404) {
                        setError('Conversation not found. Creating a new one...');
                        handleNewChat();
                    } else {
                        setError('Failed to send message. Please try again.');
                    }
                } finally {
                    // Only clear navbar flag, not loading state (handled in success/error cases)
                    setHandlingNavbarMessage(false); // Reset the flag
                    
                    // Clear the loading timeout
                    clearTimeout(loadingTimeout);
                    
                    // Ensure loading state is cleared in all cases
                    setIsLoading(false);
                }
                // Clear the URL parameter
                navigate(location.pathname, { replace: true });
            };
            sendInitialMessage();
        }
    }, [location, navigate]);

    // Add cleanup for abort controller
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    // Cleanup cooldown timer on unmount
    useEffect(() => {
        return () => {
            if (cooldownTimeoutRef.current) {
                clearTimeout(cooldownTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div className={style.chatContainer} style={{position: 'relative', overflow: 'hidden'}}>
            {/* Sidebar for conversations list */}
            <Sidebar
                conversations={conversations}
                currentConversationId={conversationId}
                onNewChat={() => handleNewChat()}
                onDeleteConversation={handleDeleteConversation}
                onRenameConversation={handleRenameConversation}
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                onSelectConversation={setConversationId}
            />
            {/* Main chat area */}
            <div className="flex-1 flex flex-col" style={{position: 'relative', zIndex: 1}}>
                {/* Starfield/particle animated background */}
                <CyberBackgroundChatBot />
                {/* Chat header */}
                <header className="bg-transparent shadow-none z-10">
                    <div className="w-full flex flex-row items-center justify-between py-4 px-6">
                        <div className="flex items-center w-1/2">
                            <button
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="mr-4 text-gray-500 lg:hidden bg-transparent border-none"
                                style={{ fontSize: '1.5rem' }}
                            >
                                ☰
                            </button>
                            <h1 className="text-xl font-bold text-gray-900 truncate dark:text-white">
                                {currentConversation?.title || 'New Conversation'}
                            </h1>
                        </div>
                        <div className="flex items-center w-1/2 justify-end">
                            <button
                                onClick={() => handleNewChat()}
                                className={style.newChatBtn}
                            >
                                + New Chat
                            </button>
                        </div>
                    </div>
                </header>
                {/* Chat messages */}
                <div className={style.chatArea}>
                    {error && !error.includes('rename conversation') && (
                        <div className="p-4 bg-red-50 text-red-500 rounded-md mb-4">
                            {error}
                        </div>
                    )}
                    
                    {streamingError && (
                        <div className="p-4 bg-yellow-50 text-yellow-700 rounded-md mb-4 flex items-center justify-between">
                            <span>{streamingError}</span>
                            <button
                                onClick={() => setStreamingError(null)}
                                className="ml-2 text-yellow-500 hover:text-yellow-700"
                                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' }}
                            >
                                ×
                            </button>
                        </div>
                    )}
                    <div className="space-y-6">
                        {messages.map((msg, index) => {
                            if (msg.role === 'user') {
                                const isEditing = editingMsgIdx === index;
                                const hasVersions = msg.versions && msg.versions.length > 0;
                                const currentVersionIdx = pairVersionIdx[index] || 0;
                                const totalVersions = hasVersions ? msg.versions.length + 1 : 1; // +1 for original
                                const nextMsgIsAssistant = messages[index + 1] && messages[index + 1].role === 'assistant';
                                const assistantHasVersions = nextMsgIsAssistant && messages[index + 1].versions && messages[index + 1].versions.length > 0;
                                
                                return (
                                    <div key={index} style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', alignItems: 'flex-end' }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                {/* Version controls for user+assistant pair */}
                                {(hasVersions || assistantHasVersions) && (
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '8px', 
                                        marginBottom: '8px',
                                        padding: '4px 8px',
                                        background: 'rgba(156, 163, 175, 0.1)',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        color: '#6b7280'
                                    }}>
                                        <button
                                            onClick={() => handlePairVersionToggle(index, -1)}
                                            disabled={currentVersionIdx === 0}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: currentVersionIdx === 0 ? '#d1d5db' : '#6b7280',
                                                cursor: currentVersionIdx === 0 ? 'not-allowed' : 'pointer',
                                                padding: '2px 4px',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                            title="Previous version"
                                        >
                                            ←
                                        </button>
                                        <span style={{ fontSize: '11px', fontWeight: '500' }}>
                                            {currentVersionIdx + 1} / {totalVersions}
                                        </span>
                                        <button
                                            onClick={() => handlePairVersionToggle(index, 1)}
                                            disabled={currentVersionIdx >= totalVersions - 1}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: currentVersionIdx >= totalVersions - 1 ? '#d1d5db' : '#6b7280',
                                                cursor: currentVersionIdx >= totalVersions - 1 ? 'not-allowed' : 'pointer',
                                                padding: '2px 4px',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                            title="Next version"
                                        >
                                            →
                                        </button>
                                        
                                        {/* Submit version button - only show if not on current version */}
                                        {currentVersionIdx > 0 && (
                                            <button
                                                onClick={() => handleSubmitVersion(index, currentVersionIdx)}
                                                disabled={regeneratingResponse !== null}
                                                style={{
                                                    background: '#10b981',
                                                    border: 'none',
                                                    color: 'white',
                                                    cursor: regeneratingResponse !== null ? 'not-allowed' : 'pointer',
                                                    padding: '3px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    fontWeight: '600',
                                                    marginLeft: '4px'
                                                }}
                                                title="Submit this version and get new response"
                                            >
                                                {regeneratingResponse === (index + 1) ? '...' : '✓'}
                                            </button>
                                        )}
                                    </div>
                                )}
                                
                                {/* Icons above the message on the left */}
                                {!isEditing && (
                                    <div style={{ 
                                        display: 'flex', 
                                        gap: '8px', 
                                        marginBottom: '4px',
                                        marginRight: '8px',
                                        alignSelf: 'flex-end'
                                    }}>
                                        {/* Copy icon */}
                                        <button
                                            className="p-0 text-gray-400 focus:outline-none transition hover:text-gray-600"
                                            style={{
                                                minWidth: 22,
                                                minHeight: 22,
                                                background: 'none',
                                                border: 'none',
                                                boxShadow: 'none',
                                                color: '#9ca3af',
                                                zIndex: 2
                                            }}
                                            onClick={() => copyToClipboard(getPairDisplayedContent(msg, index))}
                                            title="Copy message"
                                            aria-label="Copy message"
                                        >
                                            <FaCopy size={13} />
                                        </button>

                                        {/* Edit icon */}
                                        <button
                                            className="p-0 text-gray-400 focus:outline-none transition hover:text-gray-600"
                                            style={{
                                                minWidth: 22,
                                                minHeight: 22,
                                                background: 'none',
                                                border: 'none',
                                                boxShadow: 'none',
                                                color: '#9ca3af',
                                                zIndex: 2
                                            }}
                                            onClick={() => {
                                                setEditingMsgIdx(index);
                                                setEditingMsgValue(msg.content);
                                                setEditError('');
                                            }}
                                            title="Edit message"
                                            aria-label="Edit message"
                                        >
                                            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.8 2.8a1.13 1.13 0 0 1 1.6 1.6l-8.2 8.2-2.2.6.6-2.2 8.2-8.2z"></path></svg>
                                        </button>
                                        
                                        {/* Version control icon */}
                                        {(hasVersions || assistantHasVersions) && (
                                            <button
                                                className="p-0 text-gray-400 focus:outline-none transition hover:text-gray-600"
                                                style={{
                                                    minWidth: 22,
                                                    minHeight: 22,
                                                    background: 'none',
                                                    border: 'none',
                                                    boxShadow: 'none',
                                                    color: '#9ca3af',
                                                    zIndex: 2
                                                }}
                                                onClick={() => {
                                                    const currentVersionIdx = pairVersionIdx[index] || 0;
                                                    const totalVersions = hasVersions ? msg.versions.length + 1 : 1;
                                                    const nextVersion = currentVersionIdx + 1;
                                                    
                                                    if (nextVersion < totalVersions) {
                                                        // Move to next version
                                                        handlePairVersionToggle(index, 1);
                                                    } else {
                                                        // Cycle back to first version (current content)
                                                        handlePairVersionToggle(index, -(currentVersionIdx));
                                                    }
                                                }}
                                                title={`Switch version (${(pairVersionIdx[index] || 0) + 1}/${hasVersions ? msg.versions.length + 1 : 1})`}
                                                aria-label="Toggle message version"
                                            >
                                                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="4" y="4" width="8" height="8" rx="1"/>
                                                    <rect x="2" y="2" width="8" height="8" rx="1"/>
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                )}
                                
                                <div className={style.userBubble} style={{ position: 'relative', minWidth: 80 }}>
                                    {/* File icon at top left if message has file */}
                                    {msg.hasFile || msg.file_id ? (
                                        <div style={{ position: 'absolute', top: -16, left: -16, display: 'flex', alignItems: 'center', zIndex: 3 }}>
                                            <FaFileAlt style={{ color: '#9ca3af', background: 'var(--navbar_background)', borderRadius: '50%', fontSize: 18 }} title="This message is about an uploaded file" />
                                            {msg.fileName || msg.file_name || msg.filename ? (
                                                <span style={{ marginLeft: 6, color: '#9ca3af', fontSize: 13, fontWeight: 500, background: 'var(--navbar_background)', padding: '0 6px', borderRadius: 6, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {msg.fileName || msg.file_name || msg.filename}
                                                </span>
                                            ) : null}
                                        </div>
                                    ) : null}
                                                {/* Editing input */}
                                                {isEditing ? (
                                                    <form
                                                        onSubmit={async e => {
                                                            e.preventDefault();
                                                            const prevMessages = [...messages];
                                                            setMessages(msgs => {
                                                                const newMsgs = [...msgs];
                                                                newMsgs[index] = { ...newMsgs[index], content: editingMsgValue };
                                                                return newMsgs;
                                                            });
                                                            await handleEditSubmit(index, prevMessages);
                                                        }}
                                                        style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 80 }}
                                                    >
                                                        <input
                                                            className="rounded-md border border-gray-200 dark:border-gray-700 bg-[var(--body_background)] dark:bg-[var(--navbar_background)] text-[var(--text_color)] px-2 py-0.5 text-xs shadow-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none transition mb-1 font-medium"
                                                            value={editingMsgValue}
                                                            onChange={handleEditInputChange}
                                                            autoFocus
                                                            disabled={editLoading}
                                                            maxLength={4000}
                                                            style={{ minHeight: 22, fontSize: '0.89rem', fontWeight: 500, boxShadow: '0 1px 4px 0 rgba(41,45,50,0.05)' }}
                                                            placeholder="Edit..."
                                                        />
                                                        {editError && <div className="text-xs text-red-500 mb-1">{editError}</div>}
                                                        <div style={{ display: 'flex', gap: '0.2rem', marginTop: 1 }}>
                                                            <button
                                                                type="submit"
                                                                className="px-1.5 py-0.5 rounded bg-blue-500 text-white font-semibold transition text-xs flex items-center gap-1 shadow-sm"
                                                                disabled={editLoading || !editingMsgValue.trim() || editingMsgValue.length > 4000}
                                                                style={{ minWidth: 0, fontSize: '0.85rem', height: 22 }}
                                                            >
                                                                {editLoading ? <FaSpinner className="animate-spin" size={11} /> : <FaCheck size={11} />}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-100 font-semibold transition text-xs flex items-center gap-1 shadow-sm"
                                                                onClick={() => { setEditingMsgIdx(null); setEditingMsgValue(''); setEditError(''); }}
                                                                disabled={editLoading}
                                                                style={{ minWidth: 0, fontSize: '0.85rem', height: 22 }}
                                                            >
                                                                <FaTimes size={11} />
                                                            </button>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    <ReactMarkdown components={components}>
                                                        {getPairDisplayedContent(msg, index)}
                                                    </ReactMarkdown>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            } else if (msg.role === 'assistant') {
                                const isRegenerating = regeneratingResponse === index;
                                const isStreamingThis = msg.isStreaming;
                                return (
                                    <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                                        {/* Copy icon above the message */}
                                        {!isRegenerating && (
                                            <button
                                                className="p-0 text-gray-400 focus:outline-none transition hover:text-gray-600"
                                                style={{
                                                    marginBottom: '4px',
                                                    marginLeft: '8px',
                                                    minWidth: 22,
                                                    minHeight: 22,
                                                    background: 'none',
                                                    border: 'none',
                                                    boxShadow: 'none',
                                                    color: '#9ca3af',
                                                    zIndex: 2,
                                                    alignSelf: 'flex-start'
                                                }}
                                                onClick={() => copyToClipboard(getPairDisplayedContent(msg, index, true))}
                                                title="Copy message"
                                                aria-label="Copy message"
                                            >
                                                <FaCopy size={13} />
                                            </button>
                                        )}
                                        
                                        <div className={style.assistantBubble}>
                                            {isRegenerating ? (
                                                <div className={style.spinner}></div>
                                            ) : (
                                                <ReactMarkdown components={components}>
                                                    {getPairDisplayedContent(msg, index, true)}
                                                </ReactMarkdown>
                                            )}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })}
                        {streamingResponse && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                                {/* Copy icon above the streaming response */}
                                <button
                                    className="p-0 text-gray-400 focus:outline-none transition hover:text-gray-600"
                                    style={{
                                        marginBottom: '4px',
                                        marginLeft: '8px',
                                        minWidth: 22,
                                        minHeight: 22,
                                        background: 'none',
                                        border: 'none',
                                        boxShadow: 'none',
                                        color: '#9ca3af',
                                        zIndex: 2,
                                        alignSelf: 'flex-start'
                                    }}
                                    onClick={() => copyToClipboard(streamingResponse)}
                                    title="Copy message"
                                    aria-label="Copy message"
                                >
                                    <FaCopy size={13} />
                                </button>
                                
                                <div className={style.assistantBubble} style={{ position: 'relative' }}>
                                    <ReactMarkdown components={components}>
                                        {streamingResponse}
                                    </ReactMarkdown>
                                    
                                    {/* Cancel streaming button */}
                                    {abortControllerRef.current && (
                                        <button
                                            onClick={() => {
                                                if (abortControllerRef.current) {
                                                    abortControllerRef.current.abort();
                                                    setStreamingResponse('');
                                                    setIsLoading(false);
                                                }
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: '6px',
                                                right: '6px',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                borderRadius: '3px',
                                                color: '#ef4444',
                                                fontSize: '10px',
                                                padding: '2px 6px',
                                                cursor: 'pointer',
                                                zIndex: 10,
                                                minWidth: 'auto',
                                                height: '20px'
                                            }}
                                            title="Stop generation"
                                        >
                                            Stop
                                        </button>
                                    )}
                                    
                                    {/* Progress indicator */}
                                    {streamingProgress > 0 && streamingProgress < 100 && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '0',
                                            left: '0',
                                            right: '0',
                                            height: '2px',
                                            background: 'rgba(59, 130, 246, 0.2)',
                                            borderRadius: '0 0 8px 8px'
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                background: '#3b82f6',
                                                width: `${streamingProgress}%`,
                                                transition: 'width 0.3s ease',
                                                borderRadius: '0 0 8px 0'
                                            }} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {isLoading && !streamingResponse && (
                            console.log('🔧 Showing loading spinner - isLoading:', isLoading, 'streamingResponse:', streamingResponse?.length || 0),
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                                <div className={style.assistantBubble}>
                                    <div className={style.spinner}></div>
                                </div>
                            </div>
                        )}
                        <div ref={messageEndRef} />
                    </div>
                </div>
                {/* File upload and message input row */}
                <form onSubmit={handleSubmit} className={style.inputBar}>
                        {/* Attachment icons */}
                            <button
                                type="button"
                        className="p-2 rounded-full hover:bg-gray-200 text-gray-500 bg-transparent border-none"
                                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                                tabIndex={0}
                                aria-label="Attach file"
                            >
                                <FaPaperclip size={20} />
                            </button>
                            <button
                                type="button"
                        className="p-2 rounded-full hover:bg-gray-200 text-gray-500 bg-transparent border-none"
                                onClick={() => setShowFileSelector(true)}
                                tabIndex={0}
                                aria-label="Select previous file"
                            >
                                <FaHistory size={20} />
                            </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".txt,.json,.pdf,.docx"
                            onChange={handleFileInputChange}
                            style={{ display: 'none' }}
                        />
                        <button
                            type="button"
                            className={`p-2 rounded-full border-none transition focus:outline-none ${webSearchEnabled ? 'text-blue-600 dark:text-blue-300' : 'text-gray-500'}`}
                            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                            tabIndex={0}
                            aria-label={webSearchEnabled ? "Web search enabled" : "Enable web search"}
                            title={webSearchEnabled ? "Web search enabled - click send to search" : "Click to enable web search"}
                        >
                            <FiGlobe size={20} />
                        </button>
                        <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            disabled={isLoading}
                            placeholder="Ask a cybersecurity question..."
                            className={`${style.inputText}`}
                            spellCheck={true}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !message.trim() || isCooldown}
                        className={style.sendButton}
                            aria-label="Send message"
                        >
                            <FiArrowUp size={22} />
                        </button>
                    </form>
                {/* File/reply chips above input */}
                {uploadedFileDisplay && !fileLocked && (
                    <div className={
                        uploadStatus && uploadStatus.includes('success') && !uploading
                            ? `${style.fileChip} ${style.fileChipSuccess}`
                            : style.fileChip
                    }>
                        <FaFileAlt className={style.fileIcon} />
                        <span className="truncate max-w-[180px]">{uploadedFileDisplay}</span>
                        {uploading && (
                            <span className={style.uploadingStatus}>
                                <FaSpinner className={style.spinnerIcon} />
                                Uploading
                                <span className="uploadingDots">
                                    <span className="dot">.</span>
                                    <span className="dot">.</span>
                                    <span className="dot">.</span>
                                </span>
                            </span>
                        )}
                        {uploadProgress > 0 && uploadProgress < 100 && (
                            <div className={style.progressBar}>
                                <div 
                                    className={style.progressFill} 
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        )}
                        {uploadStatus && uploadStatus.includes('success') && !uploading && (
                            <span className={style.successStatus}>
                                <FaCheckCircle className={style.statusIcon} /> {uploadStatus}
                            </span>
                        )}
                        {uploadError && (
                            <span className={style.errorStatus}>
                                <FaTimesCircle className={style.statusIcon} /> {uploadError}
                            </span>
                        )}
                        <button
                            onClick={clearUploadedFile}
                            className={style.fileRemoveBtn + " ml-2 text-blue-400 hover:text-red-500 focus:outline-none"}
                            aria-label="Remove file"
                        >
                            ×
                        </button>
                    </div>
                )}
                {replyTo && (
                    <div
                        className={style.replyChip}
                        onClick={() => {
                            if (replyTo.index !== undefined) {
                                const el = document.getElementById(`msg-${replyTo.index}`);
                                if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    el.classList.add('highlight-reply');
                                    setTimeout(() => el.classList.remove('highlight-reply'), 1500);
                                }
                            }
                        }}
                        title="Click to view replied message"
                    >
                        <span className="text-xs text-gray-600">Replying to:</span>
                        <div className="text-sm text-gray-800 truncate">{getReplyPreview(replyTo.msg?.content)}</div>
                        <button
                            className="absolute top-1 right-2 text-gray-400 hover:text-red-500"
                            onClick={e => { e.stopPropagation(); setReplyTo(null); }}
                            title="Cancel reply"
                        >
                            ×
                        </button>
            </div>
                )}
                {uploading && <span className="text-xs text-blue-600 ml-2">Uploading...</span>}
                {/* Show cooldown error if present */}
                {isCooldown && (
                    <div className={style.errorMessage}>
                        You are sending messages too quickly. Please wait a few seconds and try again.
                    </div>
                )}
            </div>
            {/* Add File Selector Modal */}
            <FileSelector 
                open={showFileSelector}
                onClose={() => setShowFileSelector(false)}
                files={fileListMode === 'all' ? previousFiles : conversationFiles}
                loading={loadingPreviousFiles}
                onSelect={selectPreviousFile}
                mode={fileListMode}
                onModeChange={setFileListMode}
            />
        </div>
    );
}

import React, { useState, useEffect, useRef, useCallback } from 'react'
import style from './Chatbot.module.css';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Sidebar from './Sidebar';
import { FaPaperclip, FaHistory, FaSpinner } from 'react-icons/fa';
import { FiArrowUp, FiGlobe, FiFile } from 'react-icons/fi';
import { motion } from 'framer-motion';
import CyberBackgroundChatBot from './CyberBackgroundChatBot';
import FileSelector from './FileSelector';

// Configure axios with base URL
const API_BASE_URL = 'http://localhost:5000'; // Change this to your Flask backend URL
const api = axios.create({
    baseURL: API_BASE_URL
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('userToken');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
});

// Add response interceptor for better error handling
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401 || error.response?.status === 404 || error.response?.status === 422) {
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

    // Define functions that need to be used by other functions
    const handleNewChat = async (title = 'New Conversation') => {
        // Defensive: If title is an event object, ignore it and use default
        if (title && typeof title === 'object') {
            title = 'New Conversation';
        }
        try {
            // Only send title if it's not the default
            const data = title && title !== 'New Conversation' ? { title } : {};
            const response = await api.post('/conversations/new', data);
            const newConversation = response.data.conversation;
            setConversations(prev => sortConversations([newConversation, ...prev]));
            setConversationId(newConversation.id);
        } catch (err) {
            // Optionally handle error
            console.error('Failed to create new conversation:', err);
        }
    };

    const handleDeleteConversation = async (id) => {
        try {
            await api.delete(`/conversations/${id}`);
            setConversations(prev => sortConversations(prev.filter(conv => conv.id !== id)));
            if (id === conversationId) {
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
            const response = await api.put(`/conversations/${id}/rename`, { title: newTitle });
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
        if (err.response?.status === 401 || err.response?.status === 404 || err.response?.status === 422) {
            localStorage.removeItem('userToken');
            navigate('/signin');
            return true;
        }
        return false;
    }

    // --- Conversation fetch ---
    const fetchConversations = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/conversations');
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
    }, [retryCount, navigate]);

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
    const fetchConversation = async (id = conversationId) => {
        if (!id) return;
        try {
            const response = await api.get(`/conversations/${id}`);
            if (response.data && response.data.conversation) {
                const conv = response.data.conversation;
                setMessages(conv.messages || []);
                setCurrentConversation(conv);
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
        } catch (err) {
            if (handleAuthError(err, navigate)) return;
            console.error('Error fetching conversation:', err);
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

    // Streaming send message
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;
        setIsLoading(true);
        setError('');
        let convId = conversationId;
        try {
            // If no conversationId, create a new conversation first
            if (!convId) {
                const createResp = await api.post('/conversations/new', { title: 'New Conversation' });
                if (createResp.data && createResp.data.conversation) {
                    convId = createResp.data.conversation.id;
                    setConversations(prev => [createResp.data.conversation, ...prev]);
                    setConversationId(convId);
                } else {
                    setError('Failed to create new conversation.');
                    setIsLoading(false);
                    return;
                }
            }

            const payload = {
                message,
                force_web_search: webSearchEnabled,
                replyTo: replyTo?.msg ? {
                    index: replyTo.index,
                    content: replyTo.msg.content,
                    isCurrentVersion: true
                } : undefined,
                file_id: uploadedFile?.file_id || null
            };

            const response = await api.post(
                `/chat/${convId}`,
                payload,
                {
                    responseType: 'text',
                }
            );

            // Update messages before any navigation
            setMessages(prev => [
                ...prev,
                { role: 'user', content: message },
                { role: 'assistant', content: response.data }
            ]);
            setMessage('');
            setWebSearchEnabled(false);
            setReplyTo(null);
            if (uploadedFile) {
                setUploadedFile(null);
                setUploadedFileDisplay(null);
                setFileLocked(false);
            }
            await fetchConversation(convId);
        } catch (err) {
            console.error('Error sending message:', err);
            if (err.response?.status === 404) {
                setError('Conversation not found. Creating a new one...');
                handleNewChat();
            } else {
                setError('Failed to send message. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Refactor handleSubmit to use axios for streaming if possible
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim() || !conversationId) return;
        setAutoSearchActive(false);
        setReplyTo(null);
        const userMessage = {
            role: 'user',
            content: message,
        };
        if (replyTo && replyTo.msg) {
            userMessage.replyTo = {
                index: replyTo.index,
                content: replyTo.msg.content
            };
        }
        const fileId = uploadedFile?.file_id || null;
        if (uploadedFileDisplay && fileId) {
            userMessage.hasFile = true;
            userMessage.fileName = uploadedFileDisplay;
            userMessage.file_id = fileId;
        }
        setMessages(prevMessages => [...prevMessages, userMessage]);
        setMessage('');
        setIsLoading(true);
        setStreamingResponse('');
        try {
            const endpoint = webSearchEnabled
                ? `/conversations/${conversationId}/web_search`
                : `/chat/${conversationId}`;
            const payloadData = {
                message,
                force_web_search: false,
                replyTo: replyTo?.msg ? {
                    index: replyTo.index,
                    content: replyTo.msg.content,
                    isCurrentVersion: true
                } : undefined,
                file_id: fileId
            };

            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('userToken')}`
                },
                body: JSON.stringify(payloadData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (!response.body) throw new Error('No response body');
            const reader = response.body.getReader();
            let partial = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = new TextDecoder().decode(value);
                partial += chunk;
                setStreamingResponse(partial);
            }
            setStreamingResponse('');
            const wasWebSearchUsed = webSearchEnabled || response.headers.get('X-Web-Search-Used') === 'true';
            if (wasWebSearchUsed) {
                setAutoSearchActive(true);
            }
            await fetchConversation();
            setWebSearchEnabled(false);
            setUploadedFile(null);
            setUploadedFileDisplay(null);
            setFileLocked(false);
        } catch (error) {
            console.error('Error sending message:', error);
            if (error.message.includes('404')) {
                setError('Conversation not found. Creating a new one...');
                handleNewChat();
            } else {
                setError('Failed to send message. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // --- File upload ---
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !conversationId) return;
        setUploading(true);
        setUploadStatus('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('conversation_id', conversationId);
            const response = await api.post('/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            const fileObj = {
                file_id: response.data.file_id,
                name: file.name,
                display_name: response.data.filename || file.name
            };
            setUploadedFile(fileObj);
            setUploadedFileDisplay(response.data.filename || file.name);
            setUploadStatus(response.data.msg);
            setFileLocked(false);
        } catch (err) {
            if (handleAuthError(err, navigate)) return;
            setUploadStatus('Upload failed: ' + (err.response?.data?.msg || err.message));
            setUploadedFile(null);
            setUploadedFileDisplay(null);
        } finally {
            setUploading(false);
        }
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

    // Edit submit handler (calls backend)
    const handleEditSubmit = async (index) => {
        if (!editingMsgValue.trim()) return;
        setEditLoading(true);
        setEditError('');
        try {
            const response = await api.put(
                `/conversations/${conversationId}/messages/${index}/edit`,
                { content: editingMsgValue },
            );
            if (response.data && response.data.conversation) {
                setCurrentConversation(response.data.conversation);
                setMessages(response.data.conversation.messages || []);
                setEditingMsgIdx(null);
                setEditingMsgValue('');
                setPairVersionIdx({});
            }
        } catch (err) {
            if (handleAuthError(err, navigate)) return;
            setEditError(err?.response?.data?.msg || 'Failed to edit message');
        } finally {
            setEditLoading(false);
        }
    };

    // Version toggle handler for user+assistant pair
    const handlePairVersionToggle = (userMsgIdx, direction) => {
        setPairVersionIdx(prev => {
            const msg = messages[userMsgIdx];
            const assistantMsg = messages[userMsgIdx + 1];
            const versions = msg && msg.versions ? msg.versions.length : 0;
            let current = prev[userMsgIdx] || 0;
            let next = current + direction;
            if (next < 0) next = 0;
            if (versions && next > versions) next = versions;
            return { ...prev, [userMsgIdx]: next };
        });
    };

    // Helper to get the displayed content for a user+assistant pair version
    const getPairDisplayedContent = (msg, idx, isAssistant) => {
        const vIdx = pairVersionIdx[idx] || 0;
        if (msg.versions && msg.versions.length && vIdx > 0) {
            // Most recent version is at the end
            const version = msg.versions[msg.versions.length - vIdx];
            return version ? version.content : msg.content;
        }
        return msg.content;
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
        setMessages([]);
        setCurrentConversation(null);

        const fetchCurrentConversation = async () => {
            if (!conversationId) return;
            try {
                const response = await api.get(`/conversations/${conversationId}`);

                if (response.data && response.data.conversation) {
                    const conv = response.data.conversation;
                    // Update messages array with the conversation's messages
                    setMessages(conv.messages || []);
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
    }, [conversationId]);

    // Restore the effect for ensuring new users have a conversation
    useEffect(() => {
        const createNewConversationIfNeeded = async () => {
            if (!conversationId && conversations.length === 0) {
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
            } else if (!conversationId && conversations.length > 0) {
                // If no conversation is selected but we have conversations, set the first one
                setConversationId(conversations[0].id);
            }
        };

        createNewConversationIfNeeded();
    }, [conversationId, conversations]);

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

    // Add effect to load previously uploaded files when showing selector
    useEffect(() => {
        if (showFileSelector) {
            fetchPreviousFiles();
        }
    }, [showFileSelector, fetchPreviousFiles]);

    // Handle incoming message from navbar
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const incomingMessage = searchParams.get('message');
        
        if (incomingMessage) {
            // Add the message to the chat
            const newMessage = {
                role: 'user',
                content: incomingMessage,
                timestamp: new Date().toISOString()
            };
            
            setMessages(prev => [...prev, newMessage]);
            setIsLoading(true);
            
            // Clear the URL parameter
            navigate(location.pathname, { replace: true });
            
            // Here you would typically make your API call
            // For now, we'll simulate a response after 2 seconds
            setTimeout(() => {
                setIsLoading(false);
                // Add your API response handling here
            }, 2000);
        }
    }, [location, navigate]);

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
            <div className="flex-1 flex flex-col" style={{position: 'relative', zIndex: 1, overflow: 'hidden'}}>
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
                    <div className="space-y-6">
                        {messages.map((msg, index) => {
                            if (msg.role === 'user') {
                                return (
                                    <div key={index} style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                                        <div className={style.userBubble}>
                                            <ReactMarkdown components={components}>
                                                {getPairDisplayedContent(msg, index)}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                );
                            } else if (msg.role === 'assistant') {
                                return (
                                    <div key={index} style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                                        <div className={style.assistantBubble}>
                                            <ReactMarkdown components={components}>
                                                {getPairDisplayedContent(msg, index, true)}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })}
                        {streamingResponse && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                                <div className={style.assistantBubble}>
                                    <ReactMarkdown components={components}>
                                        {streamingResponse}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        )}
                        {isLoading && !streamingResponse && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                                <div className={style.assistantBubble}>
                                    <div className={style.spinner}></div>
                                </div>
                            </div>
                        )}
                        <div ref={messageEndRef} />
                    </div>
                </div>
                {/* File upload and message input row */}
                <form onSubmit={handleSendMessage} className={style.inputBar}>
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
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                        <button
                            type="button"
                        className={`p-2 rounded-full hover:bg-gray-200 text-gray-500 bg-transparent border-none${webSearchEnabled ? ' text-blue-600' : ''}`}
                            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                        tabIndex={0}
                            aria-label={webSearchEnabled ? "Web search enabled" : "Enable web search"}
                        title={webSearchEnabled ? "Web search enabled - click send to search" : "Click to enable web search"}
                        >
                            <FiGlobe size={20} />
                        </button>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            disabled={isLoading}
                            placeholder="Ask a cybersecurity question..."
                        className={style.inputText}
                            rows={2}
                            spellCheck={true}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !message.trim()}
                        className={style.sendButton}
                            aria-label="Send message"
                        >
                            <FiArrowUp size={22} />
                        </button>
                    </form>
                {/* File/reply chips above input */}
                {uploadedFileDisplay && !fileLocked && (
                    <div className={style.fileChip}>
                        <span className="truncate max-w-[180px]">{uploadedFileDisplay}</span>
                        {uploadStatus && (
                            <span className={`ml-3 text-xs ${uploadStatus.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{uploadStatus}</span>
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
            </div>
            {/* Add File Selector Modal */}
            <FileSelector 
                open={showFileSelector}
                onClose={() => setShowFileSelector(false)}
                files={previousFiles}
                loading={loadingPreviousFiles}
                onSelect={selectPreviousFile}
            />
        </div>
    );
}

import React, { useState, useEffect, useRef, useCallback } from 'react'
import style from './Chatbot.module.css';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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

export default function Chatbot() {
    const { conversationId } = useParams();
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
            const token = localStorage.getItem('userToken');
            // Only send title if it's not the default
            const data = title && title !== 'New Conversation' ? { title } : {};
            const response = await axios.post(
                '/conversations/new',
                data,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            const newConversation = response.data.conversation;
            setConversations(prev => sortConversations([newConversation, ...prev]));
            navigate(`/chat/${newConversation.id}`);
        } catch (err) {
            // Optionally handle error
            console.error('Failed to create new conversation:', err);
        }
    };

    const handleDeleteConversation = async (id) => {
        try {
            // const token = localStorage.getItem('userToken');
            await axios.delete(`/conversations/${id}`);
            setConversations(prev => sortConversations(prev.filter(conv => conv.id !== id)));
            if (id === conversationId) {
                if (conversations.length > 1) {
                    // Find the next conversation to navigate to
                    const nextConv = conversations.find(conv => conv.id !== id);
                    if (nextConv) {
                        navigate(`/chat/${nextConv.id}`);
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
            const token = localStorage.getItem('userToken');
            await axios.put(
                `/conversations/${id}/rename`,
                { title: newTitle },
                { headers: { Authorization: `Bearer ${token}` } }
            );
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


    // Function to fetch the latest conversation data
    const fetchConversation = async () => {
        if (!conversationId) return;
        try {
            const token = localStorage.getItem('userToken');
            const response = await axios.get(`/conversations/${conversationId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
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
        } catch (error) {
            console.error('Error fetching conversation:', error);
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

    // Fetch all conversations on mount and after relevant actions
    const fetchConversations = useCallback(async () => {
        try {
            setIsLoading(true);
            const token = localStorage.getItem('userToken');
            const response = await axios.get('/conversations', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const convs = response.data.conversations || [];
                setConversations(sortConversations(convs));
                setConversationsLoaded(true);
                setRetryCount(0); // Reset retry count on successful load
        } catch (err) {
            console.error("Error fetching conversations:", err);
            if (retryCount < 3) {
                setTimeout(() => {
                    setRetryCount(prev => prev + 1);
                }, 500); // Retry after 500ms
            }
        } finally {
            setIsLoading(false);
        }
    }, [retryCount]);

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

    // Streaming send message
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!message.trim() || !conversationId) return;
        setIsLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('userToken');
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
            const response = await axios.post(
                `/chat/${conversationId}`,
                payload,
                {
                headers: {
                        'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    },
                    responseType: 'text', // Expect plain text response
                }
            );
            // Add user message to chat
            setMessages(prev => [...prev, { role: 'user', content: message }]);
            setMessage('');
            // Add assistant response to chat
            setMessages(prev => [...prev, { role: 'user', content: message }, { role: 'assistant', content: response.data }]);
        } catch (err) {
            setError('Failed to send message');
            console.error('Error sending message:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Modified submit handler to track file attachment
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim() || !conversationId) return;

        // Reset auto search indicator
        setAutoSearchActive(false);
        setReplyTo(null);

        // Build the user message
        const userMessage = {
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

        // Add file information if available
        const fileId = uploadedFile?.file_id || null;
        if (uploadedFileDisplay && fileId) {
            userMessage.hasFile = true;
            userMessage.fileName = uploadedFileDisplay;
            userMessage.file_id = fileId;
        }

        // Immediately update local state with file information
        const newMessageIndex = messages.length;
        setMessages(prevMessages => [...prevMessages, userMessage]);
        setMessage('');
        setIsLoading(true);
        setStreamingResponse('');

        try {
            // Send the message to the server
            const token = localStorage.getItem('userToken');

            // Determine which endpoint to use based on webSearchEnabled
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
                file_id: fileId // Send file_id to the server
            };

            console.log('Sending message with payload:', payloadData);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payloadData)
            });

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

            // Check if web search was used
            const wasWebSearchUsed = webSearchEnabled || response.headers.get('X-Web-Search-Used') === 'true';
            if (wasWebSearchUsed) {
                setAutoSearchActive(true);
            }

            // Fetch updated conversation
            await fetchConversation();

            // Reset web search mode after sending
            setWebSearchEnabled(false);

            // Clear uploaded file after sending
            setUploadedFile(null);
            setUploadedFileDisplay(null);
            setFileLocked(false);

        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Update the file upload handler
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !conversationId) return;

        setUploading(true);
        setUploadStatus('');

        try {
            const token = localStorage.getItem('userToken');
            const formData = new FormData();
            formData.append('file', file);
            formData.append('conversation_id', conversationId);

            const response = await axios.post('/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                },
            });

            // Set uploaded file data with file_id from response
            const fileObj = {
                file_id: response.data.file_id,
                name: file.name,
                display_name: response.data.filename || file.name
            };

            setUploadedFile(fileObj);
            setUploadedFileDisplay(response.data.filename || file.name);
            setUploadStatus(response.data.msg);
            setFileLocked(false); // Ensure the file can be removed
        } catch (err) {
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
            const token = localStorage.getItem('userToken');
            const response = await axios.put(
                `/conversations/${conversationId}/messages/${index}/edit`,
                { content: editingMsgValue },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (response.data && response.data.conversation) {
                setCurrentConversation(response.data.conversation);
                setMessages(response.data.conversation.messages || []);
                setEditingMsgIdx(null);
                setEditingMsgValue('');
                setPairVersionIdx({});
            }
        } catch (err) {
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
                const token = localStorage.getItem('userToken');
                const response = await axios.get(`/conversations/${conversationId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

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
                    const token = localStorage.getItem('userToken');
                    const response = await axios.post(
                        '/conversations/new',
                        { title: 'New Conversation' },
                        {
                            headers: { 
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    if (response.data && response.data.conversation) {
                        const newConversation = response.data.conversation;
                        // Add the new conversation to the list
                        setConversations(prev => sortConversations([newConversation, ...prev]));
                        // Navigate to the new conversation
                        navigate(`/chat/${newConversation.id}`);
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
                // If no conversation is selected but we have conversations, navigate to the first one
                navigate(`/chat/${conversations[0].id}`);
            }
        };

        createNewConversationIfNeeded();
    }, [conversationId, conversations, navigate]);

    // Add function to fetch previously uploaded files
    const fetchPreviousFiles = useCallback(async () => {
        try {
            setLoadingPreviousFiles(true);
            const token = localStorage.getItem('userToken');
            const response = await axios.get('/user/files', {
                headers: { Authorization: `Bearer ${token}` }
            });
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

            const token = localStorage.getItem('userToken');
            const response = await axios.get(`/file/${fileId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

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
        } catch (error) {
            console.error('Error selecting file:', error);
            if (error.response?.status === 404) {
                setUploadStatus('File not found or not authorized');
            } else {
                setUploadStatus('Error selecting file: ' + (error.response?.data?.msg || error.message));
            }
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
                                const assistantMsg = messages[index + 1] && messages[index + 1].role === 'assistant' ? messages[index + 1] : null;
                                return (
                                    <React.Fragment key={index}>
                                        <motion.div
                                            ref={el => messageRefs.current[index] = el}
                                            className={style.userBubble + ' group'}
                                            id={`msg-${index}`}
                                            initial={{ opacity: 0, x: 40 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.3, type: 'tween' }}
                                        >
                                            {/* File info */}
                                            {msg.hasFile && msg.fileName && (
                                                <div className={style.fileChip}>
                                                    <FaPaperclip className="mr-2" />
                                                    <span className="truncate max-w-[120px]">{msg.fileName}</span>
                                                </div>
                                            )}
                                            {/* Reply context */}
                                            {msg.replyTo && (
                                                <div
                                                    className={style.replyChip + ' mb-1'}
                                                    onClick={() => {
                                                        if (msg.replyTo.index !== undefined) {
                                                            const el = document.getElementById(`msg-${msg.replyTo.index}`);
                                                            if (el) {
                                                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                el.classList.add('highlight-reply');
                                                                setTimeout(() => el.classList.remove('highlight-reply'), 1500);
                                                            }
                                                        }
                                                    }}
                                                    title="Click to view replied message"
                                                >
                                                    Replying to: {getReplyPreview(msg.replyTo.content)}
                                                </div>
                                            )}
                                            {/* EDIT MODE: Show textarea if editing this message */}
                                            {editingMsgIdx === index ? (
                                                <div className="flex flex-col gap-2">
                                                    <textarea
                                                        className="w-full rounded border border-gray-300 dark:border-gray-600 p-2 text-gray-900 dark:text-white bg-white dark:bg-[#23273a]"
                                                        value={editingMsgValue}
                                                        onChange={e => setEditingMsgValue(e.target.value)}
                                                        rows={3}
                                                        autoFocus
                                                        disabled={editLoading}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                handleEditSubmit(index);
                                                            } else if (e.key === 'Escape') {
                                                                setEditingMsgIdx(null);
                                                                setEditingMsgValue('');
                                                            }
                                                        }}
                                                    />
                                                    <div className="flex gap-2 mt-1">
                                                        <button
                                                            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm disabled:opacity-50"
                                                            onClick={() => handleEditSubmit(index)}
                                                            disabled={editLoading || !editingMsgValue.trim()}
                                                            type="button"
                                                        >
                                                            {editLoading ? 'Saving...' : 'Save'}
                                                        </button>
                                                        <button
                                                            className="px-3 py-1 rounded bg-gray-300 text-gray-800 hover:bg-gray-400 text-sm"
                                                            onClick={() => { setEditingMsgIdx(null); setEditingMsgValue(''); }}
                                                            type="button"
                                                            disabled={editLoading}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                    {editError && <div className="text-red-500 text-xs mt-1">{editError}</div>}
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Message content */}
                                                    <ReactMarkdown components={components}>
                                                        {getPairDisplayedContent(msg, index)}
                                                    </ReactMarkdown>
                                                    {/* Actions (copy, edit, reply, version toggle) */}
                                                    <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                        <button
                                                            onClick={() => navigator.clipboard.writeText(getPairDisplayedContent(msg, index))}
                                                            title="Copy message"
                                                            className="p-1 rounded hover:bg-gray-200 focus:outline-none"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                                                                <rect x="3" y="3" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditingMsgIdx(index);
                                                                setEditingMsgValue(getPairDisplayedContent(msg, index));
                                                            }}
                                                            title="Edit message"
                                                            className="p-1 rounded hover:bg-gray-200 focus:outline-none"
                                                            disabled={editLoading}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13zm0 0V21h8" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const currentDisplayedContent = getPairDisplayedContent(msg, index);
                                                            const replyMsg = { ...msg, content: currentDisplayedContent };
                                                                setReplyTo({ index, msg: replyMsg });
                                                            }}
                                                            title="Reply to message"
                                                            className="p-1 rounded hover:bg-gray-200 focus:outline-none"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="black" viewBox="0 0 24 24">
                                                                <path d="M21 11H6.41l5.3-5.29a1 1 0 10-1.42-1.42l-7 7a1 1 0 000 1.42l7 7a1 1 0 001.42-1.42L6.41 13H21a1 1 0 100-2z" />
                                                            </svg>
                                                        </button>
                                                        {msg.versions && msg.versions.length > 0 && (
                                                            <div className="flex items-center gap-1 ml-1">
                                                                <button
                                                                    onClick={() => handlePairVersionToggle(index, 1)}
                                                                    disabled={(pairVersionIdx[index] || 0) >= msg.versions.length}
                                                                    className="p-1 text-xs rounded hover:bg-gray-200"
                                                                    title="Previous version"
                                                                >&#8592;</button>
                                                                <span className="text-xs">{(pairVersionIdx[index] || 0) + 1}/{(msg.versions?.length || 0) + 1}</span>
                                                                <button
                                                                    onClick={() => handlePairVersionToggle(index, -1)}
                                                                    disabled={(pairVersionIdx[index] || 0) <= 0}
                                                                    className="p-1 text-xs rounded hover:bg-gray-200"
                                                                    title="Next version"
                                                                >&#8594;</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </motion.div>
                                        {/* Assistant response for this user message */}
                                        {assistantMsg && (
                                            <motion.div
                                                ref={el => messageRefs.current[index + 1] = el}
                                                className={style.assistantBubble + ' group'}
                                                id={`msg-${index + 1}`}
                                                initial={{ opacity: 0, x: -40 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ duration: 0.3, type: 'tween' }}
                                            >
                                                        <ReactMarkdown components={components}>
                                                            {getPairDisplayedContent(assistantMsg, index, true)}
                                                        </ReactMarkdown>
                                                <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                        <button
                                                        onClick={() => navigator.clipboard.writeText(getPairDisplayedContent(assistantMsg, index, true))}
                                                            title="Copy message"
                                                            className="p-1 rounded hover:bg-gray-200 focus:outline-none"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                                                                <rect x="3" y="3" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const currentDisplayedContent = getPairDisplayedContent(assistantMsg, index, true);
                                                            const replyMsg = { ...assistantMsg, content: currentDisplayedContent };
                                                                setReplyTo({ index: index + 1, msg: replyMsg });
                                                            }}
                                                            title="Reply to message"
                                                            className="p-1 rounded hover:bg-gray-200 focus:outline-none"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="black" viewBox="0 0 24 24">
                                                                <path d="M21 11H6.41l5.3-5.29a1 1 0 10-1.42-1.42l-7 7a1 1 0 000 1.42l7 7a1 1 0 001.42-1.42L6.41 13H21a1 1 0 100-2z" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                            </motion.div>
                                        )}
                                    </React.Fragment>
                                );
                            }
                            return null;
                        })}
                        {streamingResponse && (
                            <motion.div
                                className={style.assistantBubble}
                                initial={{ opacity: 0, x: -40 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, type: 'tween' }}
                            >
                                    <ReactMarkdown components={components}>
                                        {streamingResponse}
                                    </ReactMarkdown>
                            </motion.div>
                        )}
                        {isLoading && !streamingResponse && (
                            <motion.div
                                className={style.assistantBubble}
                                initial={{ opacity: 0, x: -40 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, type: 'tween' }}
                            >
                                <div className={style.loadingSpinner}>
                                    <FaSpinner className="animate-spin" />
                                    <span>Thinking...</span>
                                    </div>
                            </motion.div>
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

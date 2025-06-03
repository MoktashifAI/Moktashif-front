import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import style from './Sidebar.module.css';
import { motion } from 'framer-motion';
import { FiGlobe } from 'react-icons/fi';

const Sidebar = ({
    conversations,
    currentConversationId,
    onNewChat,
    onDeleteConversation,
    onRenameConversation,
    isOpen,
    onToggle
}) => {
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [errorModal, setErrorModal] = useState({ open: false, message: '' });

    useEffect(() => {
        if (!search.trim()) {
            setSearchResults([]);
            setSearching(false);
            return;
        }
        setSearching(true);
        const timeout = setTimeout(async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`/conversations/search?q=${encodeURIComponent(search)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSearchResults(res.data.results || []);
            } catch (err) {
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [search]);

    const handleEdit = (conv) => {
        setEditingId(conv.id);
        setEditTitle(conv.title);
    };

    const handleSave = async (id) => {
        if (editTitle.trim()) {
            const result = await onRenameConversation(id, editTitle.trim());
            if (result && result.error) {
                setErrorModal({ open: true, message: result.error });
            }
        }
        setEditingId(null);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown date';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Unknown date';
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const month = months[date.getMonth()];
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        let hour = date.getHours();
        let minute = String(date.getMinutes()).padStart(2, '0');
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12;
        hour = hour ? hour : 12;
        return `${month} ${day} ${year}, ${hour}:${minute} ${ampm}`;
    };

    // Utility to highlight search terms in text
    function highlightText(text, keyword) {
        if (!keyword) return text;
        const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.split(regex).map((part, i) =>
            regex.test(part) ? <mark key={i} className="bg-yellow-200 text-gray-900 px-0.5 rounded">{part}</mark> : part
        );
    }

    const ErrorModal = ({ open, message, onClose }) => {
        if (!open) return null;
        return (
            <div className="fixed inset-0 flex items-center justify-center z-50">
                <div className="bg-black bg-opacity-50 absolute inset-0"></div>
                <div className="relative bg-white rounded shadow-lg p-6 w-80 max-w-full text-gray-900 animate-fade-in">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-red-600">Error</span>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-700 text-lg font-bold"
                            aria-label="Close error modal"
                        >
                            ×
                        </button>
                    </div>
                    <div className="text-sm">{message}</div>
                </div>
            </div>
        );
    };

    return (
        <>
            <ErrorModal open={errorModal.open} message={errorModal.message} onClose={() => setErrorModal({ open: false, message: '' })} />
            <motion.div
                className={style.sidebarContainer}
                initial={{ x: isOpen ? 0 : -350, opacity: 0 }}
                animate={{ x: isOpen ? 0 : -350, opacity: 1 }}
                transition={{ duration: 0.5, type: 'spring' }}
            >
                <div className={style.sidebarHeader}>Moktashif</div>
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search conversations..."
                    className={style.searchBar}
                            />
                <motion.button
                    onClick={onNewChat}
                    className={style.newChatBtn}
                    whileHover={{ scale: 1.07 }}
                    whileTap={{ scale: 0.97 }}
                                >
                    + New Chat
                </motion.button>
                    {/* Conversations list or search results */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div>
                            {search.trim() ? (
                                searching ? (
                                    <div className="text-center text-gray-400 py-4 animate-pulse">Searching...</div>
                                ) : searchResults.length > 0 ? (
                                searchResults.map((conv, idx) => (
                                    <motion.div
                                        key={conv.id}
                                        className={
                                            `${style.conversationItem} ${conv.id === currentConversationId ? style.activeConversation : ''}`
                                        }
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.04, duration: 0.4, type: 'spring' }}
                                    >
                                            <Link
                                                to={
                                                    conv.match_type === 'message' && conv.matches && conv.matches.length > 0
                                                        ? `/chat/${conv.id}#msg-${conv.matchIndexes && conv.matchIndexes[0] !== undefined ? conv.matchIndexes[0] : 0}`
                                                        : `/chat/${conv.id}`
                                                }
                                            className="w-full"
                                            >
                                                <div className="flex flex-col">
                                                <span className="truncate font-medium">
                                                        {conv.match_type === 'title' ? (
                                                            highlightText(conv.title, search)
                                                        ) : (
                                                            conv.title
                                                        )}
                                                    </span>
                                                    {conv.match_type === 'message' && conv.snippet && (
                                                        <span className="text-xs text-primary-300 mt-1">
                                                            ...{highlightText(conv.snippet, search)}...
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {formatDate(conv.created_at || conv.updated_at)}
                                                </div>
                                            </Link>
                                    </motion.div>
                                    ))
                                ) : (
                                    <div className="text-center text-gray-400 py-4">No results found</div>
                                )
                            ) : conversations.length > 0 ? (
                            conversations.map((conv, idx) => (
                                <motion.div
                                        key={conv.id}
                                    className={
                                        `${style.conversationItem} ${conv.id === currentConversationId ? style.activeConversation : ''}`
                                    }
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.04, duration: 0.4, type: 'spring' }}
                                    >
                                        {editingId === conv.id ? (
                                        <div className="p-2 w-full">
                                                <input
                                                    type="text"
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSave(conv.id);
                                                        if (e.key === 'Escape') setEditingId(null);
                                                    }}
                                                    autoFocus
                                                    className="w-full bg-gray-600 text-white px-2 py-1 rounded outline-none"
                                                />
                                                <div className="flex mt-1 space-x-2">
                                                    <button
                                                        onClick={() => handleSave(conv.id)}
                                                        className="text-xs text-gray-300 hover:text-white"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="text-xs text-gray-300 hover:text-white"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <Link
                                                to={`/chat/${conv.id}`}
                                            className="w-full"
                                            >
                                                <div className="flex justify-between items-start">
                                                <div className="truncate font-medium">{conv.title}</div>
                                                    <div className="flex space-x-1 ml-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleEdit(conv);
                                                            }}
                                                            className="text-gray-400 hover:text-white"
                                                        >
                                                            ✎
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                if (window.confirm('Delete this conversation?')) {
                                                                    onDeleteConversation(conv.id);
                                                                }
                                                            }}
                                                            className="text-gray-400 hover:text-white"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {formatDate(conv.created_at || conv.updated_at)}
                                                </div>
                                            </Link>
                                        )}
                                </motion.div>
                                ))
                            ) : (
                                <div className="text-center py-4 text-gray-400">
                                    No conversations yet
                                </div>
                            )}
                        </div>
                    </div>
            </motion.div>
        </>
    );
};

export default Sidebar;
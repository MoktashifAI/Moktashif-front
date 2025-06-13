import React, { useState, useEffect } from 'react';
import axios from 'axios';
import style from './Sidebar.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import { FiGlobe, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { LuPanelLeft, LuPanelRight } from 'react-icons/lu';

const Sidebar = ({
    conversations,
    currentConversationId,
    onNewChat,
    onDeleteConversation,
    onRenameConversation,
    isOpen,
    onToggle,
    onSelectConversation
}) => {
    const [editingId, setEditingId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [errorModal, setErrorModal] = useState({ open: false, message: '' });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConvId, setDeleteConvId] = useState(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
        if (!search.trim()) {
            setSearchResults([]);
            setSearching(false);
            return;
        }
        setSearching(true);
        const timeout = setTimeout(async () => {
            try {
                const token = localStorage.getItem('userToken');
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
        const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})`, 'gi');
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

    // Sidebar width for animation
    const sidebarWidth = 300;
    const collapsedWidth = 48;

    return (
        <>
            <ErrorModal open={errorModal.open} message={errorModal.message} onClose={() => setErrorModal({ open: false, message: '' })} />
            {/* Toggle Button - always rendered, outside sidebarContainer */}
            <button
                className={style.sidebarToggleBtn + (sidebarCollapsed ? ' ' + style.collapsed : '')}
                onClick={() => setSidebarCollapsed(v => !v)}
                aria-label={sidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
            >
                {sidebarCollapsed ? <LuPanelRight /> : <LuPanelLeft />}
            </button>
            <motion.div
                className={style.sidebarContainer + (sidebarCollapsed ? ' ' + style.sidebarCollapsed : '')}
                initial={{ x: 0 }}
                animate={{ x: sidebarCollapsed ? -(sidebarWidth - collapsedWidth) : 0 }}
                transition={{ duration: 0.45, type: 'tween' }}
                style={{ width: sidebarCollapsed ? collapsedWidth : sidebarWidth, minWidth: sidebarCollapsed ? collapsedWidth : 200 }}
            >
                {!sidebarCollapsed && (
                    <>
                        <div style={{ height: '2.5rem' }}></div>
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
                            + New Conversation
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
                                                <div
                                                    className="w-full cursor-pointer"
                                                    onClick={() => onSelectConversation(conv.id)}
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
                                                </div>
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
                                                    <div className="flex gap-2 mt-1">
                                                        <button
                                                            onClick={() => handleSave(conv.id)}
                                                            className="text-xs px-3 py-1 rounded bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingId(null)}
                                                            className="text-xs px-3 py-1 rounded bg-gray-200 text-gray-800 font-semibold shadow hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 transition"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    className="w-full cursor-pointer"
                                                    onClick={() => onSelectConversation(conv.id)}
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
                                                                    setDeleteConvId(conv.id);
                                                                    setShowDeleteModal(true);
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
                                                </div>
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
                    </>
                )}
            </motion.div>
            {/* Animated Delete Modal */}
            <AnimatePresence>
                {showDeleteModal && (
                    <motion.div
                        className="fixed inset-0 flex items-center justify-center z-50"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ background: 'rgba(0,0,0,0.35)' }}
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            className="bg-white dark:bg-[#23273a] rounded-xl shadow-2xl p-7 w-80 max-w-full text-gray-900 dark:text-gray-100 animate-fade-in relative"
                        >
                            <div className="flex flex-col items-center">
                                <div className="text-4xl mb-2">🗑️</div>
                                <div className="font-bold text-lg mb-2 text-red-600 dark:text-red-400">Delete Conversation?</div>
                                <div className="text-sm mb-5 text-center text-gray-700 dark:text-gray-300">Are you sure you want to delete this conversation? This action cannot be undone.</div>
                                <div className="flex gap-4 mt-2">
                                    <button
                                        className="px-4 py-2 rounded bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition"
                                        onClick={() => {
                                            onDeleteConversation(deleteConvId);
                                            setShowDeleteModal(false);
                                        }}
                                    >
                                        Delete
                                    </button>
                                    <button
                                        className="px-4 py-2 rounded bg-gray-200 text-gray-800 font-semibold shadow hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 transition"
                                        onClick={() => setShowDeleteModal(false)}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default Sidebar;
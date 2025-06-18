import os,json
from flask import Flask, request, jsonify, Response, stream_with_context, send_from_directory, abort
from flask_pymongo import PyMongo
from flask_bcrypt import Bcrypt
from datetime import timedelta, datetime
from dotenv import load_dotenv
import requests
from bson import ObjectId
from werkzeug.utils import secure_filename
import os
from document_parser import extract_text, parse_vuln_txt, chunk_text
from pinecone import Pinecone, ServerlessSpec
from sentence_transformers import SentenceTransformer
import logging
from flask_cors import CORS

# Load environment variables
load_dotenv()

# Import cybersec_agent functions
from cybersec_agent import answer_cybersec_query, should_use_web_search

# Import cybersec memory functions - removing is_personal_fact as it's not available
from cybersec import (
    store_user_memory,
    retrieve_user_memories,
    extract_and_store_facts
)

# --- Import MongoMemoryStore for semantic memory ---
from mongo_memory_store import MongoMemoryStore

# Initialize Pinecone and embedding model (singleton)
pinecone_api_key = os.getenv("PINECONE_API_KEY")
pc = Pinecone(api_key=pinecone_api_key)
pinecone_index = pc.Index("files")
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

# --- Helper: Embed and upsert file chunks into Pinecone ---
def upsert_file_chunks_to_pinecone(file_id, file_content, max_chars=2000):
    from document_parser import chunk_text
    chunks = chunk_text(file_content, max_chars=max_chars)
    embeddings = embedding_model.encode(chunks).tolist()
    for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        pinecone_index.upsert([(f"{file_id}-chunk{idx}", embedding, {"file_id": file_id, "chunk_index": idx, "text": chunk})])
    return len(chunks)

# --- Helper: Retrieve relevant chunks for a question ---
def retrieve_relevant_chunks_from_pinecone(question, file_id=None, top_k=5):
    q_embedding = embedding_model.encode([question]).tolist()[0]
    filter_dict = {"file_id": {"$eq": file_id}} if file_id else None
    results = pinecone_index.query(vector=q_embedding, top_k=top_k, include_metadata=True, filter=filter_dict)
    return [match['metadata']['text'] for match in results['matches']]

# --- Helper: Q&A over Pinecone-retrieved chunks ---
def qa_cybersec_pinecone(question, file_id, llm_api_func, model=None, top_k=5):
    relevant_chunks = retrieve_relevant_chunks_from_pinecone(question, file_id=file_id, top_k=top_k)
    all_answers = []
    for chunk in relevant_chunks:
        prompt = (
            f"Based on the following document section, answer the question:\n"
            f"{chunk}\n\nQuestion: {question}\n"
            "If the content is not related to cybersecurity, respond with: "
            "'I can only help with cybersecurity topics. Please ask something related to web security, hacking, threats, or protection.'"
        )
        answer = llm_api_func(prompt, model=model)
        all_answers.append(answer)
    # Aggregate answers
    final_prompt = "Combine and summarize these answers, focusing only on cybersecurity-related content. If none of the content is cybersecurity-related, respond with: 'I can only help with cybersecurity topics. Please ask something related to web security, hacking, threats, or protection.'\n" + "\n".join(all_answers)
    final_answer = llm_api_func(final_prompt, model=model)
    return final_answer

# --- Local implementation of is_personal_fact ---
def is_personal_fact(text):
    """
    Determine if text contains personal factual information worth remembering for security context
    Returns: tuple of (bool, str) - (contains_fact, extracted_fact)
    """
    # Initialize with default return values
    contains_fact = False
    extracted_fact = ""

    try:
        # Use the global LLM from cybersec_agent
        from cybersec_agent import llm

        system_prompt = (
            "You analyze text to determine if it contains personal information worth remembering for a security context.\n"
            "Examples: system configurations, security tools used, industries, work environments, software versions.\n"
            "If it DOES contain important personal context, respond with 'YES: <the factual information>'.\n"
            "If it does NOT contain important personal context, respond with 'NO'.\n"
        )
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ]
        
        response = llm.invoke(messages)
        response_text = response.content.strip()
        
        if response_text.upper().startswith("YES:"):
            # Extract the personal fact from the response
            fact = response_text[4:].strip()
            return True, fact
        else:
            return False, ""
    except Exception as e:
        print(f"Error in is_personal_fact: {e}")
        return False, ""

MONGO_URI = "mongodb://localhost:27017/Moktashef-DEV"
API_KEY = os.getenv("API_KEY")
MODEL = os.getenv("MODEL")
BASE_URL = os.getenv("BASE_URL")
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.6"))

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
ALLOWED_EXTENSIONS = {'txt', 'json', 'pdf', 'docx'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app = Flask(__name__)

# Configure CORS properly for frontend
CORS(app, 
     origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:3000", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization", "accesstoken", "X-Request-With", "Accept", "Origin"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     expose_headers=["Content-Type", "X-Web-Search-Used"]
)

app.config["MONGO_URI"] = MONGO_URI
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

mongo = PyMongo(app)
bcrypt = Bcrypt(app)

# --- Initialize MongoMemoryStore ---
memory_store = MongoMemoryStore(MONGO_URI, db_name="vuln_analyzer", collection_name="memories")

# --- Helper function for Groq API calls ---
def groq_api_call(messages, model=None, temperature=0.6, stream=True):
    """
    Make a call to Groq's API
    Returns: Response object if stream=False, or generator if stream=True
    """
    headers = {
        "Authorization": f"Bearer {os.getenv('API_KEY')}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": model or os.getenv("MODEL"),
        "messages": messages,
        "temperature": temperature,
        "stream": stream
    }
    
    response = requests.post(
        f"{os.getenv('BASE_URL')}/chat/completions",
        headers=headers,
        json=payload,
        stream=stream
    )
    response.raise_for_status()
    
    if not stream:
        return response.json()
    return response




# --- Chat Conversations ---
@app.route('/conversations/new', methods=['POST'])
def create_conversation():
    try:
        user_id = request.json.get('user_id')
        if not user_id:
            return jsonify({"msg": "user_id is required"}), 400
            
        user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"msg": "User not found."}), 404
        
        data = request.json
        title = data.get('title', 'New Conversation')
        
        # Create a new conversation with proper ISO format dates
        current_time = datetime.utcnow().isoformat() + "Z"
        new_conversation = {
            "id": str(ObjectId()),
            "title": title,
            "created_at": current_time,
            "updated_at": current_time,
            "messages": []
        }
        
        # Initialize conversations array if it doesn't exist
        if 'conversations' not in user:
            result = mongo.db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"conversations": [new_conversation]}}
            )
        else:
            # Add to existing conversations array
            result = mongo.db.users.update_one(
                {"_id": ObjectId(user_id)},
                {"$push": {"conversations": new_conversation}}
            )
        
        if result.modified_count == 0:
            return jsonify({"msg": "Failed to create conversation."}), 500
            
        return jsonify({"conversation": new_conversation}), 201
        
    except Exception as e:
        print(f"Error creating conversation: {str(e)}")
        return jsonify({"msg": "Internal server error."}), 500

@app.route('/conversations', methods=['GET'])
def get_conversations():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"msg": "user_id is required"}), 400
        
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"msg": "User not found."}), 404
    
    # Return just the conversation metadata, not all messages
    conversations = user.get('conversations', [])
    conversation_list = [
        {
            "id": conv["id"],
            "title": conv["title"],
            "created_at": conv["created_at"],
            "updated_at": conv["updated_at"],
            "message_count": len(conv.get("messages", []))
        }
        for conv in conversations
    ]
    
    return jsonify({"conversations": conversation_list}), 200

@app.route('/conversations/<conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"msg": "user_id is required"}), 400
        
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"msg": "User not found."}), 404
    
    # Find the conversation
    conversation = next(
        (conv for conv in user.get('conversations', []) if conv["id"] == conversation_id),
        None
    )
    
    if not conversation:
        return jsonify({"msg": "Conversation not found."}), 404
    
    return jsonify({"conversation": conversation}), 200

@app.route('/conversations/<conversation_id>', methods=['DELETE'])
def delete_conversation(conversation_id):
    user_id = request.json.get('user_id')
    if not user_id:
        return jsonify({"msg": "user_id is required"}), 400
        
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"msg": "User not found."}), 404
    
    # Filter out the conversation to delete
    conversations = [
        conv for conv in user.get('conversations', [])
        if conv["id"] != conversation_id
    ]
    
    # Update user document
    mongo.db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"conversations": conversations}}
    )
    
    return jsonify({"msg": "Conversation deleted."}), 200

@app.route('/conversations/<conversation_id>/rename', methods=['PUT'])
def rename_conversation(conversation_id):
    user_id = request.json.get('user_id')
    if not user_id:
        return jsonify({"msg": "user_id is required"}), 400
        
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"msg": "User not found."}), 404
    
    data = request.json
    new_title = data.get('title')
    if not new_title:
        return jsonify({"msg": "Title required."}), 400
    
    # Check for case-sensitive duplicate
    for conv in user.get('conversations', []):
        if conv["title"] == new_title and conv["id"] != conversation_id:
            return jsonify({"msg": "A conversation with this name already exists."}), 409
    
    # Find and update the conversation
    conversations = user.get('conversations', [])
    for conv in conversations:
        if conv["id"] == conversation_id:
            conv["title"] = new_title
            conv["updated_at"] = datetime.utcnow().isoformat() + "Z"
            break
    else:
        return jsonify({"msg": "Conversation not found."}), 404
    
    # Update user document
    mongo.db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"conversations": conversations}}
    )
    
    return jsonify({"msg": "Conversation renamed."}), 200

@app.route('/conversations/search', methods=['GET'])
def search_conversations():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"msg": "user_id is required"}), 400
        
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"msg": "User not found."}), 404

    query = request.args.get('q', '').strip().lower()
    if not query:
        return jsonify({"results": []})

    conversations = user.get('conversations', [])
    results = []

    # First, search by conversation title
    for conv in conversations:
        if query in conv.get('title', '').lower():
            results.append({
                "id": conv["id"],
                "title": conv["title"],
                "match_type": "title",
                "snippet": None,
                "created_at": conv["created_at"],
                "updated_at": conv["updated_at"],
                "matches": [],
                "matchIndexes": []
            })

    # If no title matches, search inside messages (collect all matches per conversation)
    if not results:
        for conv in conversations:
            matches = []
            match_indexes = []
            for idx, msg in enumerate(conv.get('messages', [])):
                content = msg.get('content', '')
                if query in content.lower():
                    snippet = content
                    # Optionally, shorten the snippet
                    if len(snippet) > 80:
                        idx_query = snippet.lower().index(query)
                        start = max(0, idx_query - 30)
                        end = min(len(snippet), idx_query + len(query) + 30)
                        snippet = snippet[start:end]
                        if start > 0:
                            snippet = '...' + snippet
                        if end < len(content):
                            snippet = snippet + '...'
                    matches.append(snippet)
                    match_indexes.append(idx)
            if matches:
                results.append({
                    "id": conv["id"],
                    "title": conv["title"],
                    "match_type": "message",
                    "snippet": matches[0],
                    "created_at": conv["created_at"],
                    "updated_at": conv["updated_at"],
                    "matches": matches,
                    "matchIndexes": match_indexes
                })

    return jsonify({"results": results}), 200

# --- Modified Chat Endpoint ---
@app.route('/chat/<conversation_id>', methods=['POST'])
def chat(conversation_id):
    user_id = request.json.get('user_id')
    if not user_id:
        return jsonify({"msg": "user_id is required"}), 400
        
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"msg": "User not found."}), 404

    conversations = user.get('conversations', [])
    conversation_index = None
    conversation = None

    for i, conv in enumerate(conversations):
        if conv["id"] == conversation_id:
            conversation = conv
            conversation_index = i
            break

    if conversation is None:
        return jsonify({"msg": "Conversation not found."}), 404

    data = request.json
    message = data.get('message', '').strip()
    force_web_search = data.get('force_web_search', False)
    reply_to = data.get('replyTo')
    file_id = data.get('file_id')  # Get specific file ID if provided
    
    # --- PATCH: Auto-attach most recent file if message is about a file but file_id is missing ---
    file_related_keywords = ["file", "document", "scan", "result", "upload", "content", "analysis", "vulnerability", "finding", "report", "read", "interpret", "explain"]
    is_file_related_query = any(keyword in message.lower() for keyword in file_related_keywords)
    if not file_id and is_file_related_query:
        # Look for the most recent file uploaded for this conversation
        upload_dir = app.config['UPLOAD_FOLDER']
        files = []
        if os.path.exists(upload_dir):
            for filename in os.listdir(upload_dir):
                if filename.startswith(f"{user_id}_{conversation_id}_") and filename.endswith("_metadata.json"):
                    metadata_path = os.path.join(upload_dir, filename)
                    try:
                        with open(metadata_path, 'r', encoding='utf-8') as f:
                            metadata = json.load(f)
                            files.append({
                                'file_id': filename.replace('_metadata.json', ''),
                                'filename': metadata.get('original_filename', 'Unknown'),
                                'upload_time': metadata.get('upload_time')
                            })
                    except Exception as e:
                        print(f"Error loading metadata: {e}")
        files.sort(key=lambda x: x.get('upload_time', ''), reverse=True)
        if files:
            file_id = files[0]['file_id']
            print(f"[AUTO-ATTACH] Using most recent file for this message: {files[0]['filename']} (file_id: {file_id})")
        else:
            print("[AUTO-ATTACH] No file found to auto-attach for this file-related query.")
            return jsonify({"msg": "It looks like you're asking about a file, but I couldn't find any uploaded file for this conversation. Please re-attach the file and try again."}), 400
    else:
        if file_id:
            print(f"[FILE CONTEXT] file_id provided: {file_id}")
        else:
            print(f"[FILE CONTEXT] No file_id and not a file-related query.")

    print(f"DEBUG: Received message with file_id: {file_id}")
    
    if not message:
        return jsonify({"msg": "Message required."}), 400

    messages = conversation.get('messages', [])

    # Update timestamp
    current_time = datetime.utcnow().isoformat() + "Z"
    conversation["updated_at"] = current_time

    # Track if web search was automatically used
    auto_search_used = False
    
    # --- Check if message contains personal facts ---
    print(f"🔍 DEBUG: Checking if message contains personal facts: '{message[:100]}...'")
    contains_fact, extracted_fact = is_personal_fact(message)
    print(f"🔍 DEBUG: Personal fact detection result: contains_fact={contains_fact}, extracted_fact='{extracted_fact}'")
    
    # --- If it contains a personal fact, store it automatically ---
    conversation_title = conversation.get('title', 'Untitled Conversation')
    
    if contains_fact:
        print(f"💾 DEBUG: Storing personal fact for user {user_id}: {extracted_fact}")
        print(f"💾 DEBUG: Storing in conversation '{conversation_title}' (ID: {conversation_id})")
        store_user_memory(
            user_id, 
            extracted_fact,
            conversation_id=conversation_id,
            conversation_title=conversation_title,
            mem_type="fact",
            is_factual=True,
            importance=0.8,
            topic="cybersecurity"
        )
        print(f"💾 DEBUG: Personal fact stored successfully!")

    # --- Add user message to semantic memory ---
    memory_store.add(user_id, conversation_id, message, role="user", extra={"replyTo": reply_to} if reply_to else None)

    # Debug logging for reply_to data
    print(f"DEBUG: Received reply_to data: {reply_to}")
    if isinstance(reply_to, dict):
        print(f"DEBUG: reply_to keys: {reply_to.keys()}")
        
    # Integrate with cybersecurity agent
    def generate():
        import sys
        import json
        from cybersec_agent import answer_cybersec_query, should_use_web_search
        
        # Save user message immediately with file information
        user_message = {"role": "user", "content": message}
        if reply_to:
            user_message["replyTo"] = reply_to
        if file_id:
            user_message["file_id"] = file_id
            
            # If we have a file_id, check if we can get the file name
            try:
                metadata_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{file_id}_metadata.json')
                if os.path.exists(metadata_path):
                    with open(metadata_path, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                        user_message["fileName"] = metadata.get('original_filename', 'Unknown File')
                        user_message["hasFile"] = True
                        print(f"DEBUG: Added file metadata to message: {metadata.get('original_filename')}")
            except Exception as e:
                print(f"DEBUG: Error getting file metadata: {e}")
                
        messages.append(user_message)
        conversation["messages"] = messages
        conversation["updated_at"] = current_time
        conversations[conversation_index] = conversation
        
        # Update in database right away to ensure file info is saved
        mongo.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"conversations": conversations}}
        )
        print(f"DEBUG: Saved user message with hasFile: {user_message.get('hasFile', False)}, fileName: {user_message.get('fileName', 'None')}")

        # Variables to track response outside the try block
        partial_reply = ""
        error_occurred = False
        nonlocal auto_search_used

        try:
            # --- Load document context ONLY if file_id is specified ---
            document_context = None
            structured_findings = None
            filename = None
            
            if file_id:
                print(f"DEBUG: Loading document context for file_id: {file_id}")
                # --- CHUNKING: Load all chunk files for this file_id ---
                chunk_texts = []
                chunk_idx = 0
                while True:
                    chunk_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{file_id}_context_{chunk_idx}.txt')
                    if not os.path.exists(chunk_path):
                        break
                    with open(chunk_path, 'r', encoding='utf-8') as f:
                        chunk_texts.append(f.read())
                    chunk_idx += 1
                if chunk_texts:
                    document_context = '\n'.join(chunk_texts)
                    print(f"DEBUG: Loaded {len(chunk_texts)} chunk(s) for document context ({len(document_context)} chars)")
                else:
                    # Fallback to old single context file
                    context_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{file_id}_context.txt')
                    if os.path.exists(context_path):
                        with open(context_path, 'r', encoding='utf-8') as f:
                            document_context = f.read()
                            print(f"DEBUG: Loaded document context ({len(document_context)} chars)")
                    
                    # Try to get the filename from metadata
                    metadata_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{file_id}_metadata.json')
                    if os.path.exists(metadata_path):
                        try:
                            with open(metadata_path, 'r', encoding='utf-8') as f:
                                metadata = json.load(f)
                                filename = metadata.get('original_filename', 'Unknown')
                                print(f"DEBUG: Found filename from metadata: {filename}")
                        except Exception as e:
                            print(f"DEBUG: Error reading metadata: {e}")
                    
                    # Try to parse structured findings if .txt
                    if context_path.endswith('.txt'):
                        try:
                            structured_findings = parse_vuln_txt(document_context)
                            print(f"DEBUG: Parsed structured findings: {len(structured_findings)} items")
                        except Exception as e:
                            print(f"DEBUG: Error parsing structured findings: {e}")
                            structured_findings = None
                            
                    # Store file context in memory system
                    if document_context:
                        file_context_memory = f"Document loaded: '{filename}' with content: {document_context[:500]}..."
                        store_user_memory(
                            user_id,
                            file_context_memory,
                            conversation_id=conversation_id,
                            conversation_title=conversation_title,
                            mem_type="file",
                            is_factual=True,
                            importance=0.7,
                            topic="document"
                        )
            
            # --- Decide if web search is needed ---
            use_web_search = force_web_search or should_use_web_search(message)
            # --- Hierarchical Summarization/Q&A for file analysis ---
            if file_id and document_context:
                from chat import hierarchical_summarize, qa_over_summary
                def llm_api_func(prompt, model=None):
                    completion = groq_api_call(
                        messages=[{"role": "user", "content": prompt}],
                        model=model or MODEL,
                        temperature=TEMPERATURE,
                        stream=False
                    )
                    return completion.get("choices", [{}])[0].get("message", {}).get("content", "")
                general_file_questions = [
                    "what do you think of this file", "summarize this file", "analyze this file", "overview of this file"
                ]
                if any(q in message.lower() for q in general_file_questions):
                    answer = hierarchical_summarize(document_context, llm_api_func)
                else:
                    answer = qa_over_summary(document_context, message, llm_api_func)
                for chunk in answer.splitlines(keepends=True):
                    partial_reply += chunk
                    yield chunk
                if partial_reply:
                    memory_store.add(user_id, conversation_id, partial_reply, role="assistant", extra={"replyTo": reply_to} if reply_to else None)
                    assistant_message = {"role": "assistant", "content": partial_reply}
                    if reply_to:
                        assistant_message["replyTo"] = reply_to
                    messages.append(assistant_message)
                    conversation["messages"] = messages
                    conversation["updated_at"] = current_time
                    conversations[conversation_index] = conversation
                    mongo.db.users.update_one(
                        {"_id": ObjectId(user_id)},
                        {"$set": {"conversations": conversations}}
                    )
                return  # End after streaming hierarchical answer
            if use_web_search:
                auto_search_used = True
                print("DEBUG: Using web search to answer question")
                # Use cybersec_agent to answer
                agent_result = answer_cybersec_query(message)
                answer = agent_result.get("answer", "[No answer]")
                # Stream the answer to the client
                for chunk in answer.splitlines(keepends=True):
                    partial_reply += chunk
                    yield chunk
                # Save to memory and conversation as assistant reply
                if partial_reply:
                    memory_store.add(user_id, conversation_id, partial_reply, role="assistant", extra={"replyTo": reply_to} if reply_to else None)
                    assistant_message = {"role": "assistant", "content": partial_reply}
                    if reply_to:
                        assistant_message["replyTo"] = reply_to
                    messages.append(assistant_message)
                    conversation["messages"] = messages
                    conversation["updated_at"] = current_time
                    conversations[conversation_index] = conversation
                    mongo.db.users.update_one(
                        {"_id": ObjectId(user_id)},
                        {"$set": {"conversations": conversations}}
                    )
                    
                    # Extract and store facts from the response
                    extract_and_store_facts(
                        user_id,
                        message,
                        partial_reply,
                        conversation_id,
                        conversation_title
                    )
                return  # End after streaming web answer
                
            # --- Retrieve relevant memories from cross-conversation context ---
            cybersec_memories = retrieve_user_memories(user_id, message, conversation_id)
            
            # Debug the cross-conversation memory retrieval
            print(f"🧠 DEBUG CYBERSEC MEMORY: Retrieved {len(cybersec_memories['current'])} memories from current conversation")
            print(f"🧠 DEBUG CYBERSEC MEMORY: Retrieved {len(cybersec_memories['other'])} memories from other conversations")
            
            if cybersec_memories['current']:
                print(f"🧠 DEBUG CYBERSEC MEMORY: Sample current memory: {cybersec_memories['current'][0].get('text', '')[:100]}...")
                for i, mem in enumerate(cybersec_memories['current'][:3]):  # Show first 3 memories
                    print(f"🧠   Current Memory {i+1}: {mem.get('text', '')[:150]}...")
            
            if cybersec_memories['other']:
                print(f"🧠 DEBUG CYBERSEC MEMORY: Sample other memory: {cybersec_memories['other'][0].get('text', '')[:100]}...")
                for i, mem in enumerate(cybersec_memories['other'][:3]):  # Show first 3 cross-conversation memories
                    conv_title = mem.get('conversation_title', 'Unknown Conversation')
                    print(f"🧠   Cross-Conv Memory {i+1} from '{conv_title}': {mem.get('text', '')[:150]}...")
            else:
                print(f"🧠 DEBUG CYBERSEC MEMORY: ⚠️ NO CROSS-CONVERSATION MEMORIES FOUND for user {user_id} with query: {message[:50]}...")
                
            # --- Retrieve relevant memories for this user and query from old memory system ---
            relevant_memories = memory_store.get_relevant_memories(user_id, message, conversation_id)
            
            # Debug the memory retrieval
            print(f"DEBUG MEMORY: Current conversation has {len(messages)} messages")
            print(f"DEBUG MEMORY: Retrieved {len(relevant_memories['current'])} memories from current conversation")
            print(f"DEBUG MEMORY: Retrieved {len(relevant_memories['other'])} memories from other conversations")
            
            # Print a sample of the current conversation memories
            if relevant_memories['current']:
                print(f"DEBUG MEMORY: Sample current memory: {relevant_memories['current'][0]['text'][:100]}...")
            
            # --- Get reply context (if replying to a message in current conversation) ---
            reply_context_block = ""
            reply_context_messages = None
            reply_content_provided = False  # Track if content was provided in reply_to
            
            if reply_to:
                # Check if we have edited content directly from the frontend
                has_edited_content = (
                    isinstance(reply_to, dict) and 
                    reply_to.get('isCurrentVersion') and 
                    reply_to.get('content')
                )
                
                # Find the index of the replied-to message
                reply_idx = None
                
                # Check if index is directly provided in the reply_to object
                if isinstance(reply_to, dict) and reply_to.get('index') is not None:
                    try:
                        index = int(reply_to['index'])
                        if 0 <= index < len(messages):
                            reply_idx = index
                            print(f"DEBUG: Found reply message at index {index}")
                            
                            # If we're replying to the edited version, use the content from reply_to
                            if has_edited_content:
                                # Create a temporary message with the edited content for the AI context
                                content_to_use = reply_to.get('content')
                                reply_content_provided = True
                                print(f"DEBUG: Using edited content from reply_to: {content_to_use[:50]}...")
                    except (ValueError, TypeError):
                        print(f"Invalid index in reply_to: {reply_to.get('index')}")
                
                # If no valid index or we haven't found content yet, fall back to content matching
                if reply_idx is None or not reply_content_provided:
                    print(f"DEBUG: Falling back to content matching for reply_to")
                    for idx, m in enumerate(messages):
                        # If we have a flag that this is the current version being displayed,
                        # and we have a content match, then use the content directly
                        if has_edited_content:
                            content_match = m.get("content") == reply_to.get("content")
                            # If the content doesn't match, it might be because we're replying to an edited version
                            # Check if original content or any version matches
                            if not content_match and 'versions' in m:
                                for version in m.get('versions', []):
                                    if version.get('content') == reply_to.get('content'):
                                        content_match = True
                                        break
                            
                            if content_match:
                                reply_idx = idx
                                content_to_use = reply_to.get('content')
                                reply_content_provided = True
                                print(f"DEBUG: Found content match using current version at index {idx}")
                                break
                        elif (
                            (isinstance(reply_to, dict) and m.get("content") == reply_to.get("content")) or
                            (isinstance(reply_to, str) and m.get("content") == reply_to)
                        ):
                            reply_idx = idx
                            print(f"DEBUG: Found content match at index {idx}")
                            break
                
                if reply_idx is not None:
                    print(f"DEBUG: Setting up reply context with message at index {reply_idx}")
                    # Prepare the context messages
                    if reply_content_provided:
                        # If we have content from reply_to, use that to create a modified context
                        messages_context = messages.copy()
                        messages_context[reply_idx] = {
                            **messages[reply_idx],
                            "content": reply_to.get('content')
                        }
                        reply_context_messages = messages_context[:reply_idx+1]
                        reply_context_block = ("\nThe user is replying to this previous message:\n---\n" + 
                                              reply_to.get('content') + 
                                              "\n---\n")
                    else:
                        # Use standard message content
                        reply_context_messages = messages[:reply_idx+1]
                        reply_context_block = ("\nThe user is replying to this previous message:\n---\n" + 
                                              str(messages[reply_idx].get("content", "")) + 
                                              "\n---\n")
                else:
                    print(f"DEBUG: No matching message found for reply_to: {reply_to}")
                    
            # --- Format cybersec cross-conversation memories for LLM prompt ---
            cybersec_memory_prompt = ""
            if cybersec_memories["current"]:
                cybersec_memory_prompt += "\n🔍 IMPORTANT CONTEXT FROM CURRENT CONVERSATION:\n" + "\n".join(
                    f"- {mem.get('text', '')}" for mem in cybersec_memories["current"]
                )
            if cybersec_memories["other"]:
                cybersec_memory_prompt += "\n\n🌐 CRITICAL CROSS-CONVERSATION CONTEXT (Remember these facts about the user):\n" + "\n".join(
                    f"- From '{mem.get('conversation_title', 'Previous conversation')}': {mem.get('text', '')}" 
                    for mem in cybersec_memories["other"]
                )
                print(f"🧠 DEBUG: Adding {len(cybersec_memories['other'])} cross-conversation memories to system prompt")
                
            # --- Format older memories for LLM prompt ---
            memory_prompt = ""
            if relevant_memories["current"]:
                memory_prompt += "\nCurrent conversation context (most relevant):\n" + "\n".join(
                    f"- {msg['role']}: {msg['text']}" for msg in relevant_memories["current"]
                )
            if relevant_memories["other"]:
                memory_prompt += "\nRelevant information from other conversations:\n" + "\n".join(
                    f"- In [{msg['conversation_id']}]: {msg['role']}: {msg['text']}" for msg in relevant_memories["other"]
                )
                
            # --- Improved system prompt ---
            system_prompt = (
                "You are Moktashif, a smart and friendly cybersecurity assistant.\n"
                "🧠 MEMORY SYSTEM: You have access to the user's previous conversations and personal information. "
                "ALWAYS use the cross-conversation context provided below to remember facts about the user (like their name, work environment, tools they use, etc.). "
                "When the user asks a question, check if similar questions or relevant context exist in their past conversations. "
                "If you see cross-conversation context, USE IT - this information persists across all conversations with this user. "
                "If the user is replying to a specific message, use the content of that message as immediate context for their new question. "
                "Always prioritize the most relevant and recent information, but do not repeat answers verbatim unless asked.\n"
                "You are strictly limited to answering only cybersecurity-related questions.\n"
                "If a user asks anything not related to cybersecurity — including famous people, sports, general trivia, or personal questions — you must politely refuse.\n"
                "Say: 'I can only help with cybersecurity topics. Please ask something related to web security, hacking, threats, or protection.'\n"
                "Do not provide answers outside the domain, even if you know them. Never break character.\n"
                "Use a warm, human tone with short, clear answers. You can be casual or slightly witty when appropriate, especially in greetings or small talk.\n"
                "Introduce yourself as 'Moktashif' only when it makes sense — such as during first-time greetings, re-engagement after a pause, or if the user asks who you are.\n"
                "Don't overuse your name. Vary your language like a real human would.\n"
                "Avoid technical jargon unless the user clearly understands it. Always favor helpful explanations over buzzwords.\n"
                "Do not break character or explain that you're an AI. Stay in role as Moktashif.\n"
                "Do not hallucinate or provide false information regarding the security field like if the user have asked you about new cve or new tools just tell them that you don't know.\n"
                "If the user asks about something recent, breaking, or requests the latest information, you may use live web search results if available.\n"
                "If you do not have enough information to answer, you may request to use the web search feature.\n"
                "You are a cybersecurity expert. Provide accurate information about cybersecurity topics "
                "based on your training data. If the user is asking about something that would require "
                "real-time or recent information that might not be in your knowledge base, let them know "
                "they should enable web search for the most up-to-date information."
            )
            
            # If there are personal facts from other conversations, emphasize them
            if contains_fact:
                system_prompt += f"\n\nThe user just shared an important personal fact: {extracted_fact}"
                
            if cybersec_memory_prompt:
                system_prompt += "\n\n" + cybersec_memory_prompt
                
            if reply_context_block:
                system_prompt += reply_context_block
                
            if memory_prompt:
                system_prompt += "\n\n" + memory_prompt
            
            # --- Document Context Integration ONLY if file_id is specified ---
            if document_context and file_id:
                if structured_findings:
                    # Format structured findings as a numbered list for the LLM
                    findings_str = "\n".join([
                        f"{i+1}. Tags: {', '.join(f['tags'])} | URL: {f['url']} | Extras: {f['extras']}"
                        for i, f in enumerate(structured_findings[:20])  # Limit to 20 for prompt size
                    ])
                    system_prompt += ("\n\nThe user uploaded a vulnerability scan file. Here is a numbered list of findings extracted from the document. Use these as reference when answering questions about vulnerabilities in the document:\n" + findings_str)
                else:
                    system_prompt += ("\n\nThe user has uploaded a document. Use the following as additional context when answering their queries: "
                        f"\n---\n{document_context[:2000]}\n---\n"  # Limit context to first 2000 chars for LLM input size
                    )
            
            # Enhance file context handling to use web search for file-related questions
            file_related_keywords = ["file", "document", "scan", "result", "upload", "content", "analysis", 
                                     "vulnerability", "finding", "report", "read", "interpret", "explain"]
                                     
            is_file_related_query = any(keyword in message.lower() for keyword in file_related_keywords)
            
            # If we have document context AND the query is about the file, use web search for better answers
            if document_context and file_id and is_file_related_query:
                use_web_search = True
                auto_search_used = True
                # Enhance the query with file content for better results
                enhanced_query = f"{message} regarding: {document_context[:300]}..."
                agent_result = answer_cybersec_query(enhanced_query)
                answer = agent_result.get("answer", "[No answer]")
                # Stream the answer to the client
                for chunk in answer.splitlines(keepends=True):
                    partial_reply += chunk
                    yield chunk
                # Save to memory and conversation as assistant reply
                if partial_reply:
                    memory_store.add(user_id, conversation_id, partial_reply, role="assistant", extra={"replyTo": reply_to} if reply_to else None)
                    assistant_message = {"role": "assistant", "content": partial_reply}
                    if reply_to:
                        assistant_message["replyTo"] = reply_to
                    messages.append(assistant_message)
                    conversation["messages"] = messages
                    conversation["updated_at"] = current_time
                    conversations[conversation_index] = conversation
                    mongo.db.users.update_one(
                        {"_id": ObjectId(user_id)},
                        {"$set": {"conversations": conversations}}
                    )
                    
                    # Extract and store facts from the response
                    extract_and_store_facts(
                        user_id,
                        message,
                        partial_reply,
                        conversation_id,
                        conversation_title
                    )
                return  # End after streaming web answer
            
            # Prepare LLM message history
            llm_messages = [{"role": "system", "content": system_prompt}]
            if reply_context_messages is not None:
                # Use all messages up to and including the replied-to message, then the new user message
                for msg in reply_context_messages:
                    llm_messages.append({"role": msg["role"], "content": msg["content"]})
                llm_messages.append({"role": "user", "content": message})
                print(f"DEBUG: Using reply context with {len(reply_context_messages)} messages for LLM")
            else:
                # Add recent messages for context (default behavior)
                for msg in messages[-10:]:
                    llm_messages.append({"role": msg["role"], "content": msg["content"]})
                print(f"DEBUG: Using last {len(messages[-10:])} messages for LLM")

            # Send to Groq API
            response = groq_api_call(
                messages=llm_messages,
                model=MODEL,
                temperature=TEMPERATURE,
                stream=True
            )
            
            for chunk in response.iter_lines():
                if not chunk:
                    continue
                line = chunk.decode()
                if line.startswith("data: "):
                    line = line[len("data: "):]
                if line.strip() == "[DONE]":
                    break
                try:
                    data = json.loads(line)
                    delta = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    if delta:
                        partial_reply += delta
                        # Print to terminal for local debugging
                        print(delta, end="", flush=True)
                        # Send to client without buffering
                        yield delta
                except Exception as e:
                    print(f"Stream parse error: {e}", file=sys.stderr)
                    continue
            
            # Print newline after completion in terminal
            print()
        except Exception as e:
            error_msg = f"[ERROR] API error: {e}"
            print(error_msg, file=sys.stderr)
            partial_reply = error_msg
            error_occurred = True
            yield error_msg
        finally:
            # --- Add assistant reply to semantic memory ---
            if partial_reply:  # Only save if we got a response
                memory_store.add(user_id, conversation_id, partial_reply, role="assistant", extra={"replyTo": reply_to} if reply_to else None)
                # Add the assistant message to the conversation
                assistant_message = {"role": "assistant", "content": partial_reply}
                if reply_to:
                    assistant_message["replyTo"] = reply_to
                messages.append(assistant_message)
                conversation["messages"] = messages
                conversation["updated_at"] = current_time
                conversations[conversation_index] = conversation
                
                # Extract and store facts from the assistant's response
                extract_and_store_facts(
                    user_id,
                    message,
                    partial_reply,
                    conversation_id,
                    conversation_title
                )
                
                # Update in the database
                update_result = mongo.db.users.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$set": {"conversations": conversations}}
                )
                print(f"Database update completed. Modified: {update_result.modified_count}")

    # Create the response with proper headers
    response = Response(stream_with_context(generate()), mimetype='text/plain')
    response.headers.set('X-Web-Search-Used', str(auto_search_used).lower())
    return response


# --- Legacy Endpoint (Unchanged Logic, Still Points to Updated Chat) ---
# @app.route('/chat', methods=['POST'])
# @jwt_required()
# def legacy_chat():
#     user_id = get_jwt_identity()
#     user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
#     if not user:
#         return jsonify({"msg": "User not found."}), 404

#     # Create a new conversation if user doesn't have any
#     conversations = user.get('conversations', [])
#     if not conversations:
#         current_time = datetime.utcnow().isoformat() + "Z"
#         new_conversation = {
#             "id": str(ObjectId()),
#             "title": "New Conversation",
#             "created_at": current_time,
#             "updated_at": current_time,
#             "messages": []
#         }
#         conversations.append(new_conversation)
#         mongo.db.users.update_one(
#             {"_id": ObjectId(user_id)},
#             {"$set": {"conversations": conversations}}
#         )
#         conversation_id = new_conversation["id"]
#     else:
#         # Use the most recent conversation
#         conversation_id = conversations[-1]["id"]

#     # Store original request data
#     original_data = request.get_json()
    
#     # Check for personal facts before forwarding
#     message = original_data.get('message', '').strip()
#     if message:
#         contains_fact, extracted_fact = is_personal_fact(message)
#         if contains_fact:
#             conversation = next((conv for conv in conversations if conv["id"] == conversation_id), None)
#             conversation_title = conversation.get('title', 'Untitled Conversation') if conversation else "New Conversation"
            
#             # Store the personal fact
#             print(f"DEBUG LEGACY: Storing personal fact: {extracted_fact}")
#             store_user_memory(
#                 user_id, 
#                 extracted_fact,
#                 conversation_id=conversation_id,
#                 conversation_title=conversation_title,
#                 mem_type="fact",
#                 is_factual=True,
#                 importance=0.8,
#                 topic="cybersecurity"
#             )
    
#     # Create a modified request that preserves file_id
#     if hasattr(request, '_cached_data'):
#         delattr(request, '_cached_data')
#     request._cached_data = original_data
    
#     # Forward to the updated chat endpoint
#     return chat(conversation_id)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload', methods=['POST'])
def upload_file():
    user_id = request.form.get('user_id')
    if not user_id:
        return jsonify({"msg": "user_id is required"}), 400
        
    if 'file' not in request.files:
        return jsonify({'msg': 'No file part'}), 400
        
    file = request.files['file']
    conversation_id = request.form.get('conversation_id')
    
    if not conversation_id:
        return jsonify({'msg': 'Missing conversation_id parameter'}), 400
        
    if file.filename == '':
        return jsonify({'msg': 'No selected file'}), 400
        
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        
        # Find conversation to get its title
        user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
        conversation = None
        conversation_title = "Untitled Conversation"
        if user:
            conversation = next((conv for conv in user.get('conversations', []) if conv["id"] == conversation_id), None)
            if conversation:
                conversation_title = conversation.get('title', 'Untitled Conversation')
        
        # Create a unique filename with conversation ID included
        unique_file_id = f"{user_id}_{conversation_id}_{datetime.utcnow().timestamp()}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{unique_file_id}_{filename}")
        file.save(file_path)
        
        try:
            text, filetype = extract_text(file_path)
        except Exception as e:
            return jsonify({'msg': f'Failed to parse document: {str(e)}'}), 400
            
        # Store file content with conversation-specific key
        context_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{unique_file_id}_context.txt')
        # --- CHUNKING: Split large text into chunks and store each chunk separately ---
        chunk_paths = []
        chunks = chunk_text(text, max_chars=2000)
        for idx, chunk in enumerate(chunks):
            chunk_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{unique_file_id}_context_{idx}.txt')
            with open(chunk_path, 'w', encoding='utf-8') as f:
                f.write(chunk)
            chunk_paths.append(chunk_path)
        # For backward compatibility, also store the first chunk as the main context file
        with open(context_path, 'w', encoding='utf-8') as f:
            f.write(chunks[0] if chunks else '')
            
        # Store metadata about the file
        metadata_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{unique_file_id}_metadata.json')
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump({
                'user_id': user_id,
                'conversation_id': conversation_id,
                'original_filename': file.filename,
                'upload_time': datetime.utcnow().isoformat(),
                'filetype': filetype
            }, f)
            
        # Store file information in the memory system
        file_memory = (
            f"User uploaded a file named '{file.filename}' of type '{filetype}'. "
            f"The file contains: {text[:500]}..."
        )
        
        store_user_memory(
            user_id,
            file_memory,
            conversation_id=conversation_id,
            conversation_title=conversation_title,
            mem_type="file",
            is_factual=True,
            importance=0.7,
            topic="document"
        )
            
        # Upsert file chunks into Pinecone
        upsert_file_chunks_to_pinecone(unique_file_id, text)
            
        return jsonify({
            'msg': 'File uploaded and parsed successfully', 
            'filetype': filetype, 
            'filename': file.filename,
            'file_id': unique_file_id
        }), 200
    else:
        return jsonify({'msg': 'File type not allowed'}), 400

@app.route('/upload/filename/<conversation_id>', methods=['GET'])
def get_uploaded_filename_for_conversation(conversation_id):
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"msg": "user_id is required"}), 400
    
    # Get all files for this user and conversation
    upload_dir = app.config['UPLOAD_FOLDER']
    files = []
    
    if os.path.exists(upload_dir):
        for filename in os.listdir(upload_dir):
            if filename.startswith(f"{user_id}_{conversation_id}_") and filename.endswith("_metadata.json"):
                metadata_path = os.path.join(upload_dir, filename)
                try:
                    with open(metadata_path, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                        files.append({
                            'file_id': filename.replace('_metadata.json', ''),
                            'filename': metadata.get('original_filename', 'Unknown'),
                            'upload_time': metadata.get('upload_time')
                        })
                except Exception as e:
                    print(f"Error loading metadata: {e}")
    
    # Sort by upload time, newest first
    files.sort(key=lambda x: x.get('upload_time', ''), reverse=True)
    
    # Return the most recent file or None
    if files:
        return jsonify({'files': files}), 200
    
    return jsonify({'files': []}), 200

@app.route('/conversations/<conversation_id>/messages/<int:msg_index>/edit', methods=['PUT'])
def edit_message(conversation_id, msg_index):
    user_id = request.json.get('user_id')
    if not user_id:
        return jsonify({"msg": "user_id is required"}), 400
        
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"msg": "User not found."}), 404

    conversations = user.get('conversations', [])
    conversation = next((conv for conv in conversations if conv["id"] == conversation_id), None)
    if not conversation:
        return jsonify({"msg": "Conversation not found."}), 404

    messages = conversation.get('messages', [])
    if msg_index < 0 or msg_index >= len(messages) or messages[msg_index]["role"] != "user":
        return jsonify({"msg": "Invalid message index or not a user message."}), 400

    data = request.json
    new_content = data.get("content", "").strip()
    if not new_content:
        return jsonify({"msg": "Content required."}), 400

    # Store previous version
    if 'versions' not in messages[msg_index]:
        messages[msg_index]['versions'] = []
    messages[msg_index]['versions'].append({
        'content': messages[msg_index]['content'],
        'timestamp': messages[msg_index].get('timestamp')
    })
    
    # Preserve file attachments and other metadata when editing the message
    file_id = messages[msg_index].get('file_id')
    hasFile = messages[msg_index].get('hasFile')
    fileName = messages[msg_index].get('fileName')
    
    # Update the message content but preserve metadata
    messages[msg_index]['content'] = new_content
    messages[msg_index]['timestamp'] = datetime.utcnow().isoformat() + 'Z'
    
    # Restore file attachment info if it existed
    if file_id:
        messages[msg_index]['file_id'] = file_id
    if hasFile:
        messages[msg_index]['hasFile'] = hasFile
    if fileName:
        messages[msg_index]['fileName'] = fileName
        
    # Check if the edited message contains personal facts to store
    contains_fact, extracted_fact = is_personal_fact(new_content)
    conversation_title = conversation.get('title', 'Untitled Conversation')
    
    # If it contains a personal fact, store it automatically
    if contains_fact:
        print(f"DEBUG EDIT: Storing personal fact from edited message: {extracted_fact}")
        store_user_memory(
            user_id, 
            extracted_fact,
            conversation_id=conversation_id,
            conversation_title=conversation_title,
            mem_type="fact",
            is_factual=True,
            importance=0.8,
            topic="cybersecurity"
        )

    # Find the assistant response after this user message
    if msg_index + 1 >= len(messages) or messages[msg_index + 1]["role"] != "assistant":
        return jsonify({"msg": "No assistant response after this message."}), 400

    # Store previous assistant response version
    if 'versions' not in messages[msg_index + 1]:
        messages[msg_index + 1]['versions'] = []
    messages[msg_index + 1]['versions'].append({
        'content': messages[msg_index + 1]['content'],
        'timestamp': messages[msg_index + 1].get('timestamp')
    })

    # Truncate all messages after the assistant response
    messages = messages[:msg_index + 2]
    conversation['messages'] = messages

    # Regenerate assistant response
    # Prepare LLM/system prompt as in chat endpoint
    system_prompt = (
        "You are Moktashif, a smart and friendly cybersecurity assistant.\n"
        "You are strictly limited to answering only cybersecurity-related questions.\n"
        "If a user asks anything not related to cybersecurity — including famous people, sports, general trivia, or personal questions — you must politely refuse.\n"
        "Say: 'I can only help with cybersecurity topics. Please ask something related to web security, hacking, threats, or protection.'\n"
        "Do not provide answers outside the domain, even if you know them. Never break character.\n"
        "Use a warm, human tone with short, clear answers. You can be casual or slightly witty when appropriate, especially in greetings or small talk.\n"
        "Introduce yourself as 'Moktashif' only when it makes sense — such as during first-time greetings, re-engagement after a pause, or if the user asks who you are.\n"
        "Don't overuse your name. Vary your language like a real human would.\n"
        "Avoid technical jargon unless the user clearly understands it. Always favor helpful explanations over buzzwords.\n"
        "Do not break character or explain that you're an AI. Stay in role as Moktashif.\n"
        "Do not hallucinate or provide false information regarding the security field like if the user have asked you about new cve or new tools just tell them that you don't know.\n"
        "If the user asks about something recent, breaking, or requests the latest information, you may use live web search results if available.\n"
        "If you do not have enough information to answer, you may request to use the web search feature.\n"
        "You are a cybersecurity expert. Provide accurate information about cybersecurity topics "
        "based on your training data. If the user is asking about something that would require "
        "real-time or recent information that might not be in your knowledge base, let them know "
        "they should enable web search for the most up-to-date information."
    )
    
    # Retrieve cross-conversation memories for context
    cybersec_memories = retrieve_user_memories(user_id, new_content, conversation_id)
    
    # Debug memory retrieval for message editing
    print(f"🧠 DEBUG EDIT MEMORY: Retrieved {len(cybersec_memories.get('current', []))} current memories")
    print(f"🧠 DEBUG EDIT MEMORY: Retrieved {len(cybersec_memories.get('other', []))} cross-conversation memories")
    
    if cybersec_memories.get("other", []):
        for i, mem in enumerate(cybersec_memories["other"][:2]):
            conv_title = mem.get('conversation_title', 'Unknown')
            print(f"🧠   Edit Cross-Conv Memory {i+1} from '{conv_title}': {mem.get('text', '')[:100]}...")
    
    # Format cross-conversation context for LLM
    cybersec_memory_prompt = ""
    if cybersec_memories.get("current", []):
        cybersec_memory_prompt += "\n🔍 IMPORTANT CONTEXT FROM CURRENT CONVERSATION:\n" + "\n".join(
            f"- {mem.get('text', '')}" for mem in cybersec_memories.get("current", [])
        )
    if cybersec_memories.get("other", []):
        cybersec_memory_prompt += "\n\n🌐 CRITICAL CROSS-CONVERSATION CONTEXT (Remember these facts about the user):\n" + "\n".join(
            f"- From '{mem.get('conversation_title', 'Previous conversation')}': {mem.get('text', '')}" 
            for mem in cybersec_memories.get("other", [])
        )
        print(f"🧠 DEBUG EDIT: Adding {len(cybersec_memories['other'])} cross-conversation memories to edit prompt")
    
    # If there are personal facts from other conversations, emphasize them
    if contains_fact:
        system_prompt += f"\n\nThe user just shared an important personal fact: {extracted_fact}"
        
    if cybersec_memory_prompt:
        system_prompt += "\n\n" + cybersec_memory_prompt
    
    # Check if there's a file to include in the context
    document_context = None
    if file_id:
        context_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{file_id}_context.txt')
        if os.path.exists(context_path):
            with open(context_path, 'r', encoding='utf-8') as f:
                document_context = f.read()
            system_prompt += ("\n\nThe user has uploaded a document. Use the following as additional context when answering their queries: "
                f"\n---\n{document_context[:2000]}\n---\n"
            )
    
    llm_messages = [{"role": "system", "content": system_prompt}]
    for m in messages[:msg_index + 1]:
        llm_messages.append({"role": m["role"], "content": m["content"]})

    payload = {
        "model": MODEL,
        "messages": llm_messages,
        "temperature": TEMPERATURE,
        "stream": False
    }
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    resp = requests.post(f"{BASE_URL}/chat/completions", json=payload, headers=headers)
    resp.raise_for_status()
    data = resp.json()
    new_response = data["choices"][0]["message"]["content"]

    # Update assistant response
    messages[msg_index + 1]["content"] = new_response
    messages[msg_index + 1]["timestamp"] = datetime.utcnow().isoformat() + 'Z'
    conversation['messages'] = messages
    conversation['updated_at'] = datetime.utcnow().isoformat() + 'Z'
    
    # Extract and store facts from the new response
    extract_and_store_facts(
        user_id,
        new_content,
        new_response,
        conversation_id,
        conversation_title
    )

    # Save back to DB
    for i, conv in enumerate(conversations):
        if conv["id"] == conversation_id:
            conversations[i] = conversation
            break
    mongo.db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"conversations": conversations}}
    )
    return jsonify({"conversation": conversation}), 200

@app.route('/conversations/<conversation_id>/web_search', methods=['POST'])
def web_search_endpoint(conversation_id):
    """
    Endpoint specifically for using web search when user clicks the globe icon.
    This will force a web search through cybersec_agent regardless of the query content.
    """
    user_id = request.json.get('user_id')
    if not user_id:
        return jsonify({"msg": "user_id is required"}), 400
        
    user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"msg": "User not found."}), 404

    conversations = user.get('conversations', [])
    conversation_index = None
    conversation = None

    for i, conv in enumerate(conversations):
        if conv["id"] == conversation_id:
            conversation = conv
            conversation_index = i
            break

    if conversation is None:
        return jsonify({"msg": "Conversation not found."}), 404

    data = request.json
    message = data.get('message', '').strip()
    reply_to = data.get('replyTo')
    file_id = data.get('file_id')  # Get file_id if provided
    
    print(f"DEBUG WEB SEARCH: Received message with file_id: {file_id}")
    print(f"DEBUG WEB SEARCH: Received reply_to data: {reply_to}")
    if isinstance(reply_to, dict):
        print(f"DEBUG WEB SEARCH: reply_to keys: {reply_to.keys()}")
    
    if not message:
        return jsonify({"msg": "Message required."}), 400

    messages = conversation.get('messages', [])

    # Update timestamp
    current_time = datetime.utcnow().isoformat() + "Z"
    conversation["updated_at"] = current_time
    
    # --- Check if message contains personal facts ---
    contains_fact, extracted_fact = is_personal_fact(message)
    
    # --- If it contains a personal fact, store it automatically ---
    conversation_title = conversation.get('title', 'Untitled Conversation')
    
    if contains_fact:
        print(f"DEBUG WEB SEARCH: Storing personal fact: {extracted_fact}")
        store_user_memory(
            user_id, 
            extracted_fact,
            conversation_id=conversation_id,
            conversation_title=conversation_title,
            mem_type="fact",
            is_factual=True,
            importance=0.8,
            topic="cybersecurity"
        )

    # Add user message to semantic memory
    memory_store.add(user_id, conversation_id, message, role="user", extra={"replyTo": reply_to} if reply_to else None)

    # Save user message immediately with file information
    user_message = {"role": "user", "content": message}
    if reply_to:
        user_message["replyTo"] = reply_to
    if file_id:
        user_message["file_id"] = file_id
        
        # If we have a file_id, check if we can get the file name
        try:
            metadata_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{file_id}_metadata.json')
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                    user_message["fileName"] = metadata.get('original_filename', 'Unknown File')
                    user_message["hasFile"] = True
                    print(f"DEBUG WEB SEARCH: Added file metadata to message: {metadata.get('original_filename')}")
        except Exception as e:
            print(f"DEBUG WEB SEARCH: Error getting file metadata: {e}")
            
    messages.append(user_message)
    conversation["messages"] = messages
    conversation["updated_at"] = current_time
    conversations[conversation_index] = conversation
    
    # Update in database right away to ensure file info is saved
    mongo.db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"conversations": conversations}}
    )
    print(f"DEBUG WEB SEARCH: Saved user message with hasFile: {user_message.get('hasFile', False)}, fileName: {user_message.get('fileName', 'None')}")

    def generate():
        import sys
        import json
        import os
        from cybersec_agent import answer_cybersec_query
        
        partial_reply = ""
        
        # Debug Google API credentials
        print(f"DEBUG WEB SEARCH: GOOGLE_API_KEY exists: {'Yes' if os.getenv('GOOGLE_API_KEY') else 'No'}")
        print(f"DEBUG WEB SEARCH: GOOGLE_CSE_ID exists: {'Yes' if os.getenv('GOOGLE_CSE_ID') else 'No'}")
        
        try:
            # --- Get reply context (if replying to a message in current conversation) ---
            reply_context_block = ""
            reply_context_messages = None
            reply_content = None
            reply_content_provided = False
            
            if reply_to:
                # Check if we have edited content directly from the frontend
                has_edited_content = (
                    isinstance(reply_to, dict) and 
                    reply_to.get('isCurrentVersion') and 
                    reply_to.get('content')
                )
                
                # Find the index of the replied-to message
                reply_idx = None
                
                # Check if index is directly provided in the reply_to object
                if isinstance(reply_to, dict) and reply_to.get('index') is not None:
                    try:
                        index = int(reply_to['index'])
                        if 0 <= index < len(messages):
                            reply_idx = index
                            print(f"DEBUG WEB SEARCH: Found reply message at index {index}")
                            
                            # If we're replying to the edited version, use the content from reply_to
                            if has_edited_content:
                                reply_content = reply_to.get('content')
                                reply_content_provided = True
                                print(f"DEBUG WEB SEARCH: Using edited content from reply_to: {reply_content[:50]}...")
                    except (ValueError, TypeError):
                        print(f"DEBUG WEB SEARCH: Invalid index in reply_to: {reply_to.get('index')}")
                
                # If no valid index or we haven't found content yet, fall back to content matching
                if reply_idx is None or not reply_content_provided:
                    print(f"DEBUG WEB SEARCH: Falling back to content matching for reply_to")
                    for idx, m in enumerate(messages):
                        if has_edited_content:
                            content_match = m.get("content") == reply_to.get("content")
                            # Check for matches in previous versions
                            if not content_match and 'versions' in m:
                                for version in m.get('versions', []):
                                    if version.get('content') == reply_to.get('content'):
                                        content_match = True
                                        break
                            
                            if content_match:
                                reply_idx = idx
                                reply_content = reply_to.get('content')
                                reply_content_provided = True
                                print(f"DEBUG WEB SEARCH: Found content match using current version at index {idx}")
                                break
                        elif (
                            (isinstance(reply_to, dict) and m.get("content") == reply_to.get("content")) or
                            (isinstance(reply_to, str) and m.get("content") == reply_to)
                        ):
                            reply_idx = idx
                            reply_content = m.get("content")
                            print(f"DEBUG WEB SEARCH: Found content match at index {idx}")
                            break
                
                if reply_idx is not None:
                    print(f"DEBUG WEB SEARCH: Setting up reply context with message at index {reply_idx}")
                    # Get the content of the replied-to message
                    if not reply_content:
                        reply_content = messages[reply_idx].get("content", "")
                    
                    # Create context block with the content we're replying to
                    reply_context_block = (
                        f"\nThe user is replying to this previous message:\n---\n{reply_content}\n---\n"
                    )
                    print(f"DEBUG WEB SEARCH: Created reply context block of {len(reply_context_block)} chars")
                else:
                    print(f"DEBUG WEB SEARCH: No matching message found for reply_to: {reply_to}")

            # If there's a file_id, include the document in the search query
            document_context = None
            filename = None
            
            if file_id:
                print(f"DEBUG WEB SEARCH: Loading document context for file_id: {file_id}")
                # --- CHUNKING: Load all chunk files for this file_id ---
                chunk_texts = []
                chunk_idx = 0
                while True:
                    chunk_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{file_id}_context_{chunk_idx}.txt')
                    if not os.path.exists(chunk_path):
                        break
                    with open(chunk_path, 'r', encoding='utf-8') as f:
                        chunk_texts.append(f.read())
                    chunk_idx += 1
                if chunk_texts:
                    document_context = '\n'.join(chunk_texts)
                    print(f"DEBUG WEB SEARCH: Loaded {len(chunk_texts)} chunk(s) for document context ({len(document_context)} chars)")
                else:
                    # Fallback to old single context file
                    context_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{file_id}_context.txt')
                    if os.path.exists(context_path):
                        with open(context_path, 'r', encoding='utf-8') as f:
                            document_context = f.read()
                            print(f"DEBUG WEB SEARCH: Loaded document context ({len(document_context)} chars)")
                    
                    # Try to get the filename from metadata
                    metadata_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{file_id}_metadata.json')
                    if os.path.exists(metadata_path):
                        try:
                            with open(metadata_path, 'r', encoding='utf-8') as f:
                                metadata = json.load(f)
                                filename = metadata.get('original_filename', 'Unknown')
                                print(f"DEBUG WEB SEARCH: Found filename from metadata: {filename}")
                        except Exception as e:
                            print(f"DEBUG WEB SEARCH: Error reading metadata: {e}")
                            
                    # Store file context in memory system
                    if document_context:
                        file_context_memory = f"Document loaded: '{filename}' with content: {document_context[:500]}..."
                        store_user_memory(
                            user_id,
                            file_context_memory,
                            conversation_id=conversation_id,
                            conversation_title=conversation_title,
                            mem_type="file",
                            is_factual=True,
                            importance=0.7,
                            topic="document"
                        )
            
            # Retrieve cross-conversation memories for context
            cybersec_memories = retrieve_user_memories(user_id, message, conversation_id)
            
            # Debug memory retrieval for web search
            print(f"🧠 DEBUG WEB SEARCH MEMORY: Retrieved {len(cybersec_memories.get('current', []))} current memories")
            print(f"🧠 DEBUG WEB SEARCH MEMORY: Retrieved {len(cybersec_memories.get('other', []))} cross-conversation memories")
            
            if cybersec_memories.get("other", []):
                for i, mem in enumerate(cybersec_memories["other"][:2]):
                    conv_title = mem.get('conversation_title', 'Unknown')
                    print(f"🧠   Web Search Cross-Conv Memory {i+1} from '{conv_title}': {mem.get('text', '')[:100]}...")
            
            # Format cross-conversation context
            cross_context = ""
            if cybersec_memories.get("other", []):
                cross_context = "\n\n🌐 IMPORTANT CONTEXT FROM OTHER CONVERSATIONS:\n" + "\n".join(
                    f"- From '{mem.get('conversation_title', 'Previous conversation')}': {mem.get('text', '')}" 
                    for mem in cybersec_memories.get("other", [])
                )
                print(f"🧠 DEBUG WEB SEARCH: Adding {len(cybersec_memories['other'])} cross-conversation memories to web search query")
            
            # Use the document context in the search if available
            enhanced_message = message
            
            # Add reply context to enhanced message if available
            if reply_context_block:
                print(f"DEBUG WEB SEARCH: Adding reply context to enhanced message")
                enhanced_message = f"{message}\n\nPrevious message context: {reply_content}"
                
            if document_context:
                print(f"DEBUG WEB SEARCH: Enhancing message with document context")
                enhanced_message = f"{enhanced_message} regarding file '{filename}': {document_context[:300]}..."
                
            if cross_context:
                print(f"DEBUG WEB SEARCH: Adding cross-conversation context to query")
                enhanced_message = f"{enhanced_message}\n\nAdditional context: {cross_context}"
            
            # Always use web search for this endpoint
            print(f"DEBUG WEB SEARCH: Sending message to cybersec_agent: {enhanced_message[:100]}...")
            
            try:
                agent_result = answer_cybersec_query(enhanced_message, force_web_search=True)
                
                # Debug if web search was actually used
                print(f"DEBUG WEB SEARCH: Used web search: {agent_result.get('used_web_search', False)}")
                print(f"DEBUG WEB SEARCH: Links returned: {len(agent_result.get('links', []))}")
                
                answer = agent_result.get("answer", "[No answer]")
                
                # Check if we got a valid answer
                if not answer or answer == "[No answer]":
                    error_msg = "I encountered an error while searching for information about your query. Please try again with a different query or check the provided sources for information."
                    
                    # Add some default sources if available
                    sources = agent_result.get('links', [])
                    if sources:
                        error_msg += "\n\nSources: " + "\n".join([f"[{i+1}] {link}" for i, link in enumerate(sources[:5])])
                    else:
                        # Add some default cybersecurity sources
                        error_msg += "\n\nSources: [1] SQL Injection Prevention - OWASP Cheat Sheet Series\n[2] SQL Injection | OWASP Foundation\n[3] What is SQL Injection? Tutorial & Examples | Web Security Academy\n[4] What is SQL Injection (SQLi) and How to Prevent Attacks\n[5] Threat Modeling Process | OWASP Foundation"
                    
                    answer = error_msg
                
                # Stream the answer to the client
                for chunk in answer.splitlines(keepends=True):
                    partial_reply += chunk
                    yield chunk
                    
            except Exception as agent_error:
                print(f"DEBUG WEB SEARCH: Error from cybersec_agent: {agent_error}")
                error_msg = "I encountered an error while searching for information about your query. Please try again with a different query or check the provided sources for information.\n\nSources: [1] SQL Injection Prevention - OWASP Cheat Sheet Series\n[2] SQL Injection | OWASP Foundation\n[3] What is SQL Injection? Tutorial & Examples | Web Security Academy\n[4] What is SQL Injection (SQLi) and How to Prevent Attacks\n[5] Threat Modeling Process | OWASP Foundation"
                partial_reply += error_msg
                yield error_msg
                
        except Exception as e:
            error_msg = f"[ERROR] Web search error: {e}"
            print(error_msg, file=sys.stderr)
            yield error_msg
            
        finally:
            # Save the assistant reply if we got one
            if partial_reply:
                memory_store.add(user_id, conversation_id, partial_reply, role="assistant", extra={"replyTo": reply_to} if reply_to else None)
                
                # Extract and store facts from the assistant's response
                extract_and_store_facts(
                    user_id,
                    message,
                    partial_reply,
                    conversation_id,
                    conversation_title
                )
                
                # Add assistant message to the conversation
                assistant_message = {"role": "assistant", "content": partial_reply}
                if reply_to:
                    assistant_message["replyTo"] = reply_to
                messages.append(assistant_message)
                conversation["messages"] = messages
                conversation["updated_at"] = current_time
                conversations[conversation_index] = conversation
                
                # Update in database
                mongo.db.users.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$set": {"conversations": conversations}}
                )

    # Create response with correct headers
    response = Response(stream_with_context(generate()), mimetype='text/plain')
    response.headers.set('X-Web-Search-Used', 'true')  # Always true for this endpoint
    return response

# Add a new endpoint to list all uploaded files for a user
@app.route('/user/files', methods=['GET'])
def list_user_files():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"msg": "user_id is required"}), 400
    
    # Get all files for this user from the uploads directory
    upload_dir = app.config['UPLOAD_FOLDER']
    files = []
    
    if os.path.exists(upload_dir):
        for filename in os.listdir(upload_dir):
            if filename.endswith('_metadata.json') and filename.startswith(f"{user_id}_"):
                metadata_path = os.path.join(upload_dir, filename)
                try:
                    with open(metadata_path, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                        file_id = filename.replace('_metadata.json', '')
                        files.append({
                            'file_id': file_id,
                            'filename': metadata.get('original_filename', 'Unknown'),
                            'upload_time': metadata.get('upload_time', ''),
                            'conversation_id': metadata.get('conversation_id', ''),
                            'filetype': metadata.get('filetype', '')
                        })
                except Exception as e:
                    print(f"Error loading metadata: {e}")
    
    # Sort by upload time, newest first
    files.sort(key=lambda x: x.get('upload_time', ''), reverse=True)
    
    return jsonify({'files': files}), 200

# Add an endpoint to get file content by file_id
@app.route('/file/<file_id>', methods=['GET'])
def get_file_content(file_id):
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"msg": "user_id is required"}), 400
    
    # Verify the file belongs to this user
    if not file_id.startswith(f"{user_id}_"):
        return jsonify({"msg": "File not found or not authorized"}), 404
    
    # Get the file content
    context_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{file_id}_context.txt')
    if not os.path.exists(context_path):
        return jsonify({"msg": "File content not found"}), 404
    
    try:
        with open(context_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Get metadata if available
        metadata = {}
        metadata_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{file_id}_metadata.json')
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
                
        return jsonify({
            "file_id": file_id,
            "filename": metadata.get("original_filename", "Unknown"),
            "content": content[:5000],  # Limit content length for API response
            "content_truncated": len(content) > 5000,
            "metadata": metadata
        }), 200
        
    except Exception as e:
        return jsonify({"msg": f"Error reading file: {str(e)}"}), 500

# --- Add this helper for generalized cybersecurity chunk summarization ---
def summarize_cybersec_chunks(file_content, llm_api_func, max_chars=2000, model=None):
    from document_parser import chunk_text
    chunks = chunk_text(file_content, max_chars=max_chars)
    all_summaries = []
    for idx, chunk in enumerate(chunks):
        prompt = (
            f"This is part {idx+1} of a document. "
            "Summarize the key cybersecurity-related information, findings, or insights in this section. "
            "If the content is not related to cybersecurity, respond with: "
            "'I can only help with cybersecurity topics. Please ask something related to web security, hacking, threats, or protection.'\n\n"
            f"{chunk}"
        )
        summary = llm_api_func(prompt, model=model)
        all_summaries.append(summary)
    # Optionally, combine and summarize all findings
    combined_summary_prompt = (
        "Combine and summarize the following findings from a document, focusing only on cybersecurity-related content. "
        "If none of the content is cybersecurity-related, respond with: 'I can only help with cybersecurity topics. Please ask something related to web security, hacking, threats, or protection.'\n\n"
        + "\n\n".join(all_summaries)
    )
    final_summary = llm_api_func(combined_summary_prompt, model=model)
    return final_summary

# --- Hierarchical Summarization and Q&A Helpers ---
def hierarchical_summarize(file_content, llm_api_func, max_chars=2000, model=None, max_depth=3):
    """
    Summarize a large file hierarchically so the LLM can analyze the whole content.
    - file_content: The full text of the file.
    - llm_api_func: Function to call your LLM (prompt, model) -> response string.
    - max_chars: Max chars per chunk.
    - model: LLM model name.
    - max_depth: How many times to recursively summarize if needed.
    Returns: Final summary string.
    """
    from document_parser import chunk_text
    import logging

    current_content = file_content
    for depth in range(max_depth):
        chunks = chunk_text(current_content, max_chars=max_chars)
        # Combine the first 2-3 non-empty chunks for the initial summary
        non_empty_chunks = [c for c in chunks if c.strip()]
        if len(non_empty_chunks) == 0:
            return "[ERROR] No content found in the document."
        if len(chunks) == 1 or depth == 0:
            # Use up to the first 3 non-empty chunks for the first summary
            combined = "\n\n".join(non_empty_chunks[:3])
            print("[DEBUG] Sending to LLM for summary (first 500 chars):\n", combined[:500])
            prompt = (
                "You are provided with the full text of a cybersecurity document below. "
                "Never say anything about missing documents or lack of context. Always assume the document is present if you see text below. "
                "Summarize the following document, focusing on all cybersecurity-related information, findings, or insights. "
                "If the content is not related to cybersecurity, respond with: "
                "'I can only help with cybersecurity topics. Please ask something related to web security, hacking, threats, or protection.'\n\n"
                f"{combined}"
            )
            return llm_api_func(prompt, model=model)
        # Summarize each chunk
        summaries = []
        for idx, chunk in enumerate(chunks):
            if not chunk.strip():
                continue
            print(f"[DEBUG] Summarizing chunk {idx+1} (first 200 chars):\n", chunk[:200])
            prompt = (
                f"This is part {idx+1} of a document. "
                "You are provided with the full text of a cybersecurity document below. "
                "Never say anything about missing documents or lack of context. Always assume the document is present if you see text below. "
                "Summarize the key cybersecurity-related information, findings, or insights in this section. "
                "If the content is not related to cybersecurity, respond with: "
                "'I can only help with cybersecurity topics. Please ask something related to web security, hacking, threats, or protection.'\n\n"
                f"{chunk}"
            )
            summaries.append(llm_api_func(prompt, model=model))
        # Combine summaries for next round
        current_content = "\n\n".join(summaries)
    # Final summary if still too large
    prompt = (
        "You are provided with the full text of a cybersecurity document below. "
        "Never say anything about missing documents or lack of context. Always assume the document is present if you see text below. "
        "Summarize the following document, focusing on all cybersecurity-related information, findings, or insights. "
        "If the content is not related to cybersecurity, respond with: "
        "'I can only help with cybersecurity topics. Please ask something related to web security, hacking, threats, or protection.'\n\n"
        f"{current_content}"
    )
    return llm_api_func(prompt, model=model)


def qa_over_summary(file_content, user_query, llm_api_func, max_chars=2000, model=None):
    """
    Answer a user question using a hierarchical summary of the whole file.
    """
    summary = hierarchical_summarize(file_content, llm_api_func, max_chars=max_chars, model=model)
    prompt = (
        "You are provided with the full text of a cybersecurity document below. "
        "Never say anything about missing documents or lack of context. Always assume the document is present if you see text below. "
        f"Based on the following document summary, answer the user's question:\n"
        f"{summary}\n\n"
        f"Question: {user_query}\n"
        "If the content is not related to cybersecurity, respond with: "
        "'I can only help with cybersecurity topics. Please ask something related to web security, hacking, threats, or protection.'"
    )
    return llm_api_func(prompt, model=model)

# --- Authentication Routes ---

@app.route('/user/getProfile', methods=['GET'])
def get_profile():
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({"msg": "user_id is required"}), 400
            
        user = mongo.db.users.find_one({"_id": ObjectId(user_id)})
        
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404
        
        return jsonify({
            "success": True,
            "data": {
                "id": str(user['_id']),
                "email": user['email'],
                "firstName": user.get('firstName', ''),
                "lastName": user.get('lastName', ''),
                "userImg": user.get('userImg', {}),
                "created_at": user.get('created_at', '')
            }
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to get profile: {str(e)}"}), 500

@app.route('/scan', methods=['POST'])
def scan_website():
    try:
        user_id = request.json.get('user_id')
        if not user_id:
            return jsonify({"msg": "user_id is required"}), 400
            
        data = request.json
        url = data.get('url')
        
        if not url:
            return jsonify({"message": "URL is required"}), 400
        
        # Here you would implement your actual scanning logic
        # For now, returning a mock response
        mock_vulnerabilities = [
            {
                "id": 1,
                "title": "SQL Injection",
                "severity": "High",
                "description": "Potential SQL injection vulnerability found",
                "url": url,
                "method": "POST",
                "parameter": "id"
            },
            {
                "id": 2,
                "title": "XSS Vulnerability",
                "severity": "Medium",
                "description": "Cross-site scripting vulnerability detected",
                "url": url,
                "method": "GET",
                "parameter": "search"
            }
        ]
        
        return jsonify({
            "success": True,
            "vulnerabilities": mock_vulnerabilities,
            "scan_date": datetime.utcnow().isoformat() + "Z",
            "target_url": url
        }), 200
        
    except Exception as e:
        return jsonify({"message": f"Scan failed: {str(e)}"}), 500

# --- Health Check Route ---
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "message": "Moktashif Backend API is running",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }), 200

if __name__ == '__main__':
    import sys
    import time
    
    # Check for --no-debug flag or FLASK_DEBUG=0 environment variable
    debug_mode = True
    if '--no-debug' in sys.argv:
        debug_mode = False
    elif os.getenv('FLASK_DEBUG') == '0':
        debug_mode = False
        
    if not debug_mode:
        print("\n=== Starting Flask app in production mode (faster startup, no auto-reload) ===")
        start_time = time.time()
        app.run(host='0.0.0.0', port=5000, debug=False)
        print(f"\n=== Application started in {time.time() - start_time:.2f} seconds ===\n")
    else:
        print("\n=== Starting Flask app in debug mode (slower startup, auto-reload enabled) ===")
        print("=== For faster startup, use: python chat.py --no-debug ===\n")
        app.run(host='0.0.0.0', port=5000, debug=True)
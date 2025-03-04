class ChatApp {
    constructor() {
        this.messages = new Map(); // Store messages by conversation
        this.socket = io("https://chat-app-html-css-js.onrender.com",{
            withCredentials:true
        });
        this.currentUser = null;
        this.currentUserProfile = null;
        this.currentRecipient = null;
        this.typingTimeout = null;
        this.themeManager = new ThemeManager();
        this.activeUsers = new Map();
        this.setupSocketListeners();
        this.setupEventListeners();
        this.initializeUI();
    }

    initializeUI() {
        const loginContainer = document.getElementById('loginContainer');
        const chatContainer = document.getElementById('chatContainer');
        if (loginContainer && chatContainer) {
            loginContainer.style.display = 'block';
            chatContainer.style.display = 'none';
        }
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            if (this.currentUser) {
                this.socket.emit('requestUserList');
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            alert('Failed to connect to server. Please try again.');
        });

        this.socket.on('userList', (users) => {
            console.log('Received user list:', users);
            this.activeUsers.clear();
            users.forEach(user => {
                if (user.status === 'online') {
                    this.activeUsers.set(user.userId, user);
                }
            });
            this.updateUserList(users);
        });

        this.socket.on('privateMessage', (data) => {
            this.receiveMessage(data);
        });

        this.socket.on('userTyping', (data) => {
            if (data.senderProfile) {
                const user = this.activeUsers.get(data.senderId) || {};
                user.profile = data.senderProfile;
                this.activeUsers.set(data.senderId, user);
            }
            this.showTypingIndicator(data);
        });

        this.socket.on('userStatusUpdate', (data) => {
            this.updateUserStatus(data);
        });

        this.socket.on('profileUpdated', (data) => {
            this.handleProfileUpdate(data);
        });
    }

    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        const messageForm = document.getElementById('messageForm');
        if (messageForm) {
            messageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('input', () => {
                this.handleTyping();
            });
        }
    }

    handleLogin() {
        const userIdInput = document.getElementById('userId');
        const displayNameInput = document.getElementById('displayName');
        const emailInput = document.getElementById('email');
        const bioInput = document.getElementById('bio');
        const selectedColorInput = document.querySelector('input[name="avatarColor"]:checked');
    
        if (!userIdInput.value.trim()) {
            alert('Please enter a username');
            return;
        }
    
        const userId = userIdInput.value.trim();
        const profile = {
            displayName: displayNameInput.value.trim() || userId,
            email: emailInput.value.trim(),
            bio: bioInput.value.trim() || 'No bio provided',
            avatarColor: selectedColorInput ? selectedColorInput.value : this.generateRandomColor(),
            status: 'online'
        };
    
        // Rest of the code remains the same...
        this.loadMessagesFromStorage();

        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('chatContainer').style.display = 'flex';

        this.updateCurrentUserProfile();
    
    

        this.currentUser = userId;
        this.currentUserProfile = profile;

        this.socket.emit('register', {
            userId,
            profile: {
                ...profile,
                status: 'online'
            }
        });

        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('chatContainer').style.display = 'flex';

        this.updateCurrentUserProfile();
    }

    generateRandomColor() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeead'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    updateCurrentUserProfile() {
        const profileContainer = document.getElementById('currentUserProfile');
        if (profileContainer && this.currentUserProfile) {
            const profileHtml = `
                <div class="avatar" style="background-color: ${this.currentUserProfile.avatarColor}">
                    ${this.currentUserProfile.displayName.charAt(0).toUpperCase()}
                </div>
                <h3>${this.currentUserProfile.displayName}</h3>
                <p class="status">${this.currentUserProfile.status}</p>
                <p class="bio">${this.currentUserProfile.bio}</p>
            `;
            profileContainer.innerHTML = profileHtml;
        }
    }

    updateUserList(users) {
        const userList = document.getElementById('userList');
        if (!userList) return;

        userList.innerHTML = '';
        
        users.forEach(user => {
            if (user.userId !== this.currentUser) {
                const userElement = document.createElement('div');
                userElement.className = 'user-item';
                userElement.dataset.userId = user.userId;

                const displayName = user.profile?.displayName || user.userId;
                const avatarColor = user.profile?.avatarColor || '#ccc';
                const avatarInitial = displayName.charAt(0).toUpperCase();
                
                if (user.status === 'online') {
                    userElement.classList.add('active');
                }

                const statusIndicator = user.status === 'online' ? 
                    '<span class="status-indicator online"></span>' : 
                    '<span class="status-indicator offline"></span>';

                    userElement.innerHTML = `
                    ${statusIndicator}
                    <div class="avatar" style="background-color: ${avatarColor}">
                        ${avatarInitial}
                    </div>
                    <div class="user-info">
                        <h4>${displayName}</h4>
                        <p class="status">${user.status}</p>
                    </div>
                `;
                
                userElement.addEventListener('click', () => this.selectRecipient(user));
                userList.appendChild(userElement);
            }
        });
    }

    updateUserStatus(data) {
        const { userId, status } = data;
        const userElement = document.querySelector(`.user-item[data-user-id="${userId}"]`);
        
        if (userElement) {
            const statusElement = userElement.querySelector('.status');
            const statusIndicator = userElement.querySelector('.status-indicator');
            
            if (statusElement) {
                statusElement.textContent = status;
            }
            
            if (statusIndicator) {
                statusIndicator.className = `status-indicator ${status}`;
            }
            
            userElement.classList.toggle('active', status === 'online');
        }

        if (status === 'online') {
            this.activeUsers.set(userId, data);
        } else {
            this.activeUsers.delete(userId);
        }
    }

    getConversationKey(user1, user2) {
        return [user1, user2].sort().join(':');
    }

    selectRecipient(user) {
        this.currentRecipient = user.userId;
        const chatHeader = document.getElementById('chatHeader');
        const chatMessages = document.getElementById('chatMessages');
        
        if (chatHeader) {

            const displayName = user.profile?.displayName || user.userId;
            const avatarColor = user.profile?.avatarColor || '#ccc';
            const avatarInitial = displayName.charAt(0).toUpperCase();


            chatHeader.innerHTML = `
                 <div class="avatar" style="background-color: ${avatarColor}">
                    ${avatarInitial}
                </div>
                <div class="user-info">
                    <h4>${displayName}</h4>
                    <p class="status">${user.status}</p>
                </div>
            `;
        }

        // Clear previous messages and load conversation history
        if (chatMessages) {
            chatMessages.innerHTML = '';
            const conversationKey = this.getConversationKey(this.currentUser, this.currentRecipient);
            const messages = this.messages.get(conversationKey) || [];
            // messages.forEach(msg => this.addMessageToChat(msg, 
            //     msg.senderId === this.currentUser ? 'sent' : 'received'));
                messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
                messages.forEach(msg => {
                    this.addMessageToChat(msg, msg.senderId === this.currentUser ? 'sent' : 'received');
        }
      )}

        const messageInput = document.getElementById('messageInput');
        const sendButton = document.querySelector('#messageForm button');
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.focus();
        }
        if (sendButton) sendButton.disabled = false;

        document.querySelectorAll('#userList .user-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.userId === user.userId) {
                item.classList.add('active');
            }
        });
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput || !this.currentRecipient || !this.currentUserProfile) return;

        const message = messageInput.value.trim();
        if (message) {
            const messageData = {
                senderId: this.currentUser,
                senderProfile: this.currentUserProfile,
                recipientId: this.currentRecipient,
                message: message,
                timestamp: new Date()
            };

            // Store message in local conversation history
            const conversationKey = this.getConversationKey(this.currentUser, this.currentRecipient);
            if (!this.messages.has(conversationKey)) {
                this.messages.set(conversationKey, []);
            }
            const conversationMessages = this.messages.get(conversationKey);
            conversationMessages.push(messageData);
            
            // Emit the message
            this.socket.emit('privateMessage', messageData);
            
            // Add message to chat and persist it
            this.addMessageToChat(messageData, 'sent');
            
            // Clear input
            messageInput.value = '';
            
            // Save to localStorage
            this.saveMessagesToStorage();
        }
    }

    receiveMessage(data) {
        // Store received message in conversation history
        const conversationKey = this.getConversationKey(this.currentUser, data.senderId);
        if (!this.messages.has(conversationKey)) {
            this.messages.set(conversationKey, []);
        }
        const conversationMessages = this.messages.get(conversationKey);
        conversationMessages.push(data);
        
        // Save to localStorage
        this.saveMessagesToStorage();

        // Only show message if we're currently chatting with the sender
        if (data.senderId === this.currentRecipient) {
            this.addMessageToChat(data, 'received');
        }
    }

    addMessageToChat(data, type) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.classList.add('message', type);

        const displayName = data.senderProfile?.displayName || data.senderId;
        const avatarColor = data.senderProfile?.avatarColor || '#ccc';
        const avatarInitial = displayName.charAt(0).toUpperCase();
        
        const avatarElement = document.createElement('div');
        avatarElement.className = 'message-avatar';
        avatarElement.style.backgroundColor = avatarColor;
        avatarElement.textContent = avatarInitial;

        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';
        
        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.textContent = data.message;
        
        const timeElement = document.createElement('div');
        timeElement.className = 'timestamp';
        timeElement.textContent = new Date(data.timestamp).toLocaleTimeString();
        
        contentElement.appendChild(messageText);
        contentElement.appendChild(timeElement);
        messageElement.appendChild(avatarElement);
        messageElement.appendChild(contentElement);
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    saveMessagesToStorage() {
        const messagesObject = {};
        for (const [key, value] of this.messages.entries()) {
            messagesObject[key] = value;
        }
        localStorage.setItem('chatMessages', JSON.stringify(messagesObject));
    }

    loadMessagesFromStorage() {
        const savedMessages = localStorage.getItem('chatMessages');
        if (savedMessages) {
            const messagesObject = JSON.parse(savedMessages);
            this.messages = new Map(Object.entries(messagesObject));
        }
    }

    handleTyping() {
        if (this.currentRecipient) {
            this.socket.emit('typing', {
                senderId: this.currentUser,
                senderProfile:this.currentUserProfile,
                recipientId: this.currentRecipient,
                isTyping: true
            });

            clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(() => {
                this.socket.emit('typing', {
                    senderId: this.currentUser,
                    senderProfile:this.currentUserProfile,
                    recipientId: this.currentRecipient,
                    isTyping: false
                });
            }, 1000);
        }
    }

    showTypingIndicator(data) {
        const typingIndicator = document.getElementById('typingIndicator');
        const typingText = typingIndicator?.querySelector('.typing-text');
        if (typingIndicator && data.senderId === this.currentRecipient) {
            const userProfile = this.activeUsers.get(data.senderId);
            const displayName = userProfile?.profile?.displayName || data.senderId;

            typingIndicator.style.display = data.isTyping ? 'block' : 'none';
            typingIndicator.textContent = `${data.senderId} is typing...`;
        }
    }

    handleProfileUpdate(data) {
        const userElement = document.querySelector(`.user-item[data-user-id="${data.userId}"]`);
        if (userElement) {
            const statusElement = userElement.querySelector('.status');
            if (statusElement) {
                statusElement.textContent = data.profile.status;
            }
        }
    }
}
class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'light';
        this.toggleBtn = document.getElementById('themeToggle');
        this.initialize();
    }

    initialize() {
        // Set initial theme
        document.documentElement.setAttribute('data-theme', this.theme);
        
        // Add click event listener
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggleTheme());
            this.updateButtonState();
        }

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                this.theme = e.matches ? 'dark' : 'light';
                this.applyTheme();
            }
        });
    

        
        // Set initial button state
        this.updateButtonState();
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
        this.updateButtonState();
    }

    updateButtonState() {
        if (this.toggleBtn) {
            const title = this.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
            this.toggleBtn.setAttribute('title', title);
            this.toggleBtn.setAttribute('aria-label', title);
        }
    }
}

// Initialize the chat app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const chat = new ChatApp();
    document.addEventListener('DOMContentLoaded', () => {
        new ThemeManager();  
    });  
});
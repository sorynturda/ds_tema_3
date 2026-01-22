document.addEventListener('DOMContentLoaded', initApp);

// --- GLOBAL STATE ---
let token = null;
let userRole = null;
let userId = null;
let allUsersCache = []; // Cache for user list in assignment modal

// --- DOM ELEMENT SELECTORS ---
// Auth
const authContainer = document.getElementById('auth-container');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterLink = document.getElementById('show-register-link');
const showLoginLink = document.getElementById('show-login-link');

// App
const appContainer = document.getElementById('app-container');
const logoutButton = document.getElementById('logout-button');
const userGreeting = document.getElementById('user-greeting');

// Common
const userInfoDetails = document.getElementById('user-info-details');

// Client
const clientSection = document.getElementById('client-section');
const clientDeviceListContainer = document.getElementById('client-device-list-container');

// Admin
const adminSection = document.getElementById('admin-section');
const adminUserListBody = document.querySelector('#admin-user-list tbody');
const adminDeviceListBody = document.querySelector('#admin-device-list tbody');

// Modals
const userFormModal = document.getElementById('user-form-modal');
const userForm = document.getElementById('user-form');
const userFormTitle = document.getElementById('user-form-title');
const deviceFormModal = document.getElementById('device-form-modal');
const deviceForm = document.getElementById('device-form');
const deviceFormTitle = document.getElementById('device-form-title');
const assignDeviceModal = document.getElementById('assign-device-modal');
const assignDeviceForm = document.getElementById('assign-device-form');
const viewDeviceDetailsModal = document.getElementById('view-device-details-modal');

// Chat Elements
const chatWidgetContainer = document.getElementById('chat-widget-container');
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const chatWindow = document.getElementById('chat-window');
const chatCloseBtn = document.querySelector('.chat-close-btn');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');

const chatSendBtn = document.getElementById('chat-send-btn');
const requestAdminBtn = document.getElementById('request-admin-btn');

// Admin Chat
const activeChatsListContainer = document.getElementById('active-chats-list-container');
let currentChatTargetUserId = null; // Who the admin is currently talking to

let chatWs = null;
let recentlySentMessages = new Set(); // Track messages we just sent to avoid duplicates

/**
 * ----------------------------------------------------------------
 * ðŸš€ INITIALIZATION & APP STARTUP
 * ----------------------------------------------------------------
 */

/**
 * Main app initialization function.
 * Checks for existing token and sets up the UI.
 */
async function initApp() {
    token = localStorage.getItem('jwt');

    if (token) {
        try {
            await apiFetch('/auth/validate', {}, 'text');
            parseAndStoreToken(token);
            showDashboard();
        } catch (error) {
            // Token is invalid or expired
            console.error('Token validation failed:', error.message);
            handleLogout();
        }
    } else {
        showAuthView();
    }

    attachEventListeners();
}

/**
 * Stores token and decodes it to set global user state.
 */
function parseAndStoreToken(jwt) {
    token = jwt;
    const payload = parseJwt(jwt);
    userRole = payload.scope; // "ROLE_USER" or "ROLE_ADMIN"
    userId = payload.userId;
    localStorage.setItem('jwt', jwt);
}

/**
 * Attaches all primary event listeners for the application.
 */
function attachEventListeners() {
    // Auth
    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
    logoutButton.addEventListener('click', handleLogout);
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    });

    // Modals
    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById(btn.dataset.modal).classList.add('hidden');
        });
    });
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.add('hidden');
        }
    });

    // Admin: Show "Create" Modals
    document.getElementById('show-create-device-modal-button').addEventListener('click', showCreateDeviceModal);

    // Admin: Form Submissions
    userForm.addEventListener('submit', handleUserFormSubmit);
    deviceForm.addEventListener('submit', handleDeviceFormSubmit);
    assignDeviceForm.addEventListener('submit', handleAssignDeviceSubmit);

    // Admin: List Event Delegation (Edit, Delete, Assign)
    adminUserListBody.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const id = target.dataset.id;
        if (target.classList.contains('edit-user-btn')) {
            showEditUserModal(id);
        } else if (target.classList.contains('delete-user-btn')) {
            handleDeleteUser(id);
        }
    });

    adminDeviceListBody.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        // ... (existing code)
        const id = target.dataset.id;
        if (target.classList.contains('edit-device-btn')) {
            showEditDeviceModal(id);
        } else if (target.classList.contains('delete-device-btn')) {
            handleDeleteDevice(id);
        } else if (target.classList.contains('assign-device-btn')) {
            showAssignDeviceModal(id);
        } else if (target.classList.contains('unassign-device-btn')) {
            const userIdToUnassign = target.dataset.userid;
            handleUnassignDevice(id, userIdToUnassign);
        } else if (target.classList.contains('view-consumption-btn')) {
            const ownerId = target.dataset.ownerid;
            handleViewDeviceDetails(id, ownerId);
        }
    });

    // Admin: Active Chats Delegation
    if (activeChatsListContainer) {
        activeChatsListContainer.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (target && target.classList.contains('join-chat-btn')) {
                const userId = target.dataset.userid;
                joinChat(userId);
            }
        });
    }

    // Client: View Device Details
    clientDeviceListContainer.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (target && target.classList.contains('view-device-details-btn')) {
            // For client, ownerId is the logged-in userId
            handleViewDeviceDetails(target.dataset.id, userId);
        }
    });

    // Chat Events
    chatToggleBtn.addEventListener('click', toggleChatWindow);
    chatCloseBtn.addEventListener('click', toggleChatWindow);
    chatSendBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    if (requestAdminBtn) {
        if (userRole === 'ROLE_ADMIN') {
            requestAdminBtn.style.display = 'none';
        } else {
            requestAdminBtn.addEventListener('click', requestAdmin);
        }
    }

    // Admin: Active Chats Delegation
    if (activeChatsListContainer) {
        activeChatsListContainer.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (target && target.classList.contains('join-chat-btn')) {
                const userId = target.dataset.userid;
                joinChat(userId);
            }
        });
    }
}

/**
 * ----------------------------------------------------------------
 * ðŸ”’ AUTHENTICATION
 * ----------------------------------------------------------------
 */

/**
 * Handles user login.
 */
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const headers = {
            'Authorization': 'Basic ' + btoa(username + ':' + password)
        };
        const tokenText = await apiFetch('/auth/token', { method: 'POST', headers }, 'text');

        parseAndStoreToken(tokenText);
        showDashboard();
        loginForm.reset();
    } catch (error) {
        console.error('Login error:', error);
        // Check if it's an authentication failure
        if (error.message.includes('401') ||
            error.message.toLowerCase().includes('unauthorized') ||
            error.message.toLowerCase().includes('authentication') ||
            error.message.toLowerCase().includes('credentials')) {
            alert('Incorrect username or password.');
        } else {
            alert('Login failed: ' + error.message);
        }
    }
}

/**
 * Handles new user registration.
 */
async function handleRegister(e) {
    e.preventDefault();
    const registerDTO = {
        username: document.getElementById('reg-username').value,
        password: document.getElementById('reg-password').value,
        name: document.getElementById('reg-name').value,
        address: document.getElementById('reg-address').value,
        age: parseInt(document.getElementById('reg-age').value) || null
    };

    try {
        await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify(registerDTO)
        });
        alert('Registration successful! Please log in.');
        registerForm.reset();
        showLoginLink.click();
    } catch (error) {
        alert('Registration failed: ' + error.message);
    }
}

/**
 * Logs the user out, clears state and storage.
 */
function handleLogout() {
    token = null;
    userRole = null;
    userId = null;
    allUsersCache = [];
    localStorage.removeItem('jwt');
    localStorage.removeItem('jwt');

    // Close Chat WS
    if (chatWs) {
        chatWs.close();
        chatWs = null;
    }
    if (chatWs) {
        chatWs.close();
        chatWs = null;
    }
    chatWidgetContainer.classList.add('hidden');

    // Stop Admin Polling
    stopAdminPolling();

    showAuthView();
}

/**
 * ----------------------------------------------------------------
 * ðŸ–¥ï¸ VIEW & DASHBOARD RENDERING
 * ----------------------------------------------------------------
 */

/**
 * Shows the main app dashboard and hides the auth view.
 */
function showDashboard() {
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');

    // Reset views
    clientSection.classList.add('hidden');
    adminSection.classList.add('hidden');

    // Load common data
    loadMyInfo();

    // Load role-specific data
    if (userRole === 'ROLE_ADMIN') {
        userGreeting.textContent = `Welcome, Admin!`;
        adminSection.classList.remove('hidden');
        loadAdminData();
        // Admins don't use the chat widget - they interact through Active Chats list
    } else { // ROLE_USER
        userGreeting.textContent = `Welcome, User!`;
        clientSection.classList.remove('hidden');
        loadClientData();

        // Initialize Chat for users only
        // chat WebSocket is now opened only when the chat window is opened
        // setupChatWebSocket(userId);
        chatWidgetContainer.classList.remove('hidden');
    }
}

/**
 * Shows the authentication view and hides the app.
 */
function showAuthView() {
    appContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
}

/**
 * Loads the logged-in user's personal info.
 */
async function loadMyInfo() {
    try {
        const user = await apiFetch(`/people/${userId}`);
        userInfoDetails.innerHTML = `
            <p><strong>Name:</strong> ${user.name}</p>
            <p><strong>Address:</strong> ${user.address}</p>
            <p><strong>Age:</strong> ${user.age}</p>
            <p><strong>User ID:</strong> ${user.id}</p>
        `;
    } catch (error) {
        console.error('Failed to load my info:', error.message);
        userInfoDetails.innerHTML = '<p>Could not load user information.</p>';
    }
}

/**
 * Loads all data required for the client dashboard.
 */
async function loadClientData() {
    try {
        const devices = await apiFetch(`/devices/user/${userId}`);
        clientDeviceListContainer.innerHTML = '';
        if (devices.length === 0) {
            clientDeviceListContainer.innerHTML = '<p>You have no devices assigned to you.</p>';
            return;
        }

        devices.forEach(device => {
            const card = document.createElement('div');
            card.className = 'device-card';
            card.innerHTML = `
                <h4>${device.name}</h4>
                <p><strong>Max Consumption:</strong> ${device.consumption} kWh</p>
                <p><strong>ID:</strong> ${device.id}</p>
                <button class="view-device-details-btn" data-id="${device.id}">View Details</button>
            `;
            clientDeviceListContainer.appendChild(card);
        });
    } catch (error) {
        console.error('Failed to load client devices:', error.message);
        clientDeviceListContainer.innerHTML = '<p>Could not load devices.</p>';
    }
}

/**
 * Loads all data for the admin dashboard.
 */
let adminPollingInterval = null;

function loadAdminData() {
    loadAllUsers();
    loadAllDevices();
    loadActiveChats();
    startAdminPolling();
}

function startAdminPolling() {
    if (adminPollingInterval) clearInterval(adminPollingInterval);
    adminPollingInterval = setInterval(() => {
        loadActiveChats();
    }, 3000); // Poll every 3 seconds
}

function stopAdminPolling() {
    if (adminPollingInterval) {
        clearInterval(adminPollingInterval);
        adminPollingInterval = null;
    }
}

async function loadActiveChats() {
    try {
        const sessions = await apiFetch('/chat/sessions');
        activeChatsListContainer.innerHTML = '';

        if (sessions.length === 0) {
            activeChatsListContainer.innerHTML = '<p>No active chats.</p>';
            return;
        }

        sessions.forEach(session => {
            const card = document.createElement('div');
            card.className = 'device-card';

            // Visual highlighting based on status
            if (session.admin_requested && !session.admin_joined) {
                card.style.border = "3px solid #ff0000";
                card.style.backgroundColor = "#fff5f5";
            } else if (session.admin_joined) {
                card.style.border = "2px solid #00aa00";
                card.style.backgroundColor = "#f0fff0";
            }

            card.innerHTML = `
                <h4>User: ${session.user_id.substring(0, 8)}...</h4>
                <p><strong>Last Active:</strong> ${new Date(session.last_active * 1000).toLocaleString()}</p>
                <p><strong>Messages:</strong> ${session.message_count}</p>
                <p><strong>Admin Requested:</strong> <span style="color: ${session.admin_requested ? 'red' : 'gray'}; font-weight: bold;">${session.admin_requested ? 'YES' : 'No'}</span></p>
                <p><strong>Admin Joined:</strong> <span style="color: ${session.admin_joined ? 'green' : 'gray'};">${session.admin_joined ? 'YES' : 'No'}</span></p>
                <button class="join-chat-btn" data-userid="${session.user_id}">${session.admin_joined ? 'View Chat' : 'Join Chat'}</button>
            `;
            activeChatsListContainer.appendChild(card);
        });
    } catch (error) {
        console.error('Failed to load active chats:', error.message);
    }
}

async function joinChat(targetUserId) {
    try {
        await apiFetch('/chat/join', {
            method: 'POST',
            body: JSON.stringify({ user_id: targetUserId })
        });

        currentChatTargetUserId = targetUserId;

        // Open Chat Window
        // Use the existing chat window but contextualize it
        setupChatWebSocket(targetUserId); // Connect to THAT user's stream
        chatWidgetContainer.classList.remove('hidden');
        chatWindow.classList.remove('hidden');

        // Load history
        const history = await apiFetch(`/chat/history/${targetUserId}`);
        chatMessages.innerHTML = ''; // Clear chat
        history.forEach(msg => {
            // Admin view: 'user' messages are from customer (other), 'admin' messages are from admin (user)
            let displayAs = 'other';
            if (msg.sender === 'admin') {
                displayAs = 'user';
            } else if (msg.sender === 'user') {
                displayAs = 'other';
            } else if (msg.sender === 'assistant' || msg.sender === 'system') {
                displayAs = 'other';
            }
            addMessageToChat(msg.text, displayAs);
        });

    } catch (error) {
        alert('Failed to join chat: ' + error.message);
    }
}

async function requestAdmin() {
    try {
        await apiFetch('/chat/request-admin', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId })
        });
        alert("Administrator requested. Please wait.");
    } catch (error) {
        alert("Failed to request admin: " + error.message);
    }
}

/**
 * (Admin) Fetches and renders all users.
 */
async function loadAllUsers() {
    try {
        const users = await apiFetch('/people');
        allUsersCache = users; // Cache for assignment modal
        adminUserListBody.innerHTML = '';
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.age}</td>
                <td>
                    <div class="actions">
                        <button class="edit-user-btn" data-id="${user.id}">Edit</button>
                        <button class="delete-user-btn danger" data-id="${user.id}">Delete</button>
                    </div>
                </td>
            `;
            adminUserListBody.appendChild(row);
        });
    } catch (error) {
        console.error('Failed to load users:', error.message);
        adminUserListBody.innerHTML = '<tr><td colspan="4">Could not load users.</td></tr>';
    }
}

/**
 * (Admin) Fetches and renders all devices.
 */
async function loadAllDevices() {
    try {
        const devices = await apiFetch('/devices');
        adminDeviceListBody.innerHTML = '';

        // Fetch assignment info for each device
        const devicesWithAssignments = await Promise.all(
            devices.map(async (device) => {
                try {
                    const assignedUserId = await apiFetch(`/devices/user-mapping/${device.id}`, {}, 'text');
                    return { ...device, assignedUserId: assignedUserId && assignedUserId.trim() !== '' ? assignedUserId : null };
                } catch (error) {
                    return { ...device, assignedUserId: null };
                }
            })
        );

        devicesWithAssignments.forEach(device => {
            const row = document.createElement('tr');
            const assignedUserId = device.assignedUserId;

            let assignmentButton;
            let viewConsumptionButton = '';

            if (assignedUserId) {
                assignmentButton = `
                    <button class="unassign-device-btn secondary" data-id="${device.id}" data-userid="${assignedUserId}">
                        Unassign
                    </button>
                `;
                viewConsumptionButton = `
                    <button class="view-consumption-btn" data-id="${device.id}" data-ownerid="${assignedUserId}">
                        View Consumption
                    </button>
                `;
            } else {
                assignmentButton = `
                    <button class="assign-device-btn" data-id="${device.id}">
                        Assign
                    </button>
                `;
            }

            row.innerHTML = `
                <td>${device.id}</td>
                <td>${device.name}</td>
                <td>${device.consumption}</td>
                <td>${assignedUserId || '<em>None</em>'}</td>
                <td>
                    <div class="actions">
                        <button class="edit-device-btn" data-id="${device.id}">Edit</button>
                        <button class="delete-device-btn danger" data-id="${device.id}">Delete</button>
                        ${assignmentButton}
                        ${viewConsumptionButton}
                    </div>
                </td>
            `;
            adminDeviceListBody.appendChild(row);
        });
    } catch (error) {
        console.error('Failed to load devices:', error.message);
        adminDeviceListBody.innerHTML = '<tr><td colspan="5">Could not load devices.</td></tr>';
    }
}

/**
 * ----------------------------------------------------------------
 * ðŸ› ï¸ CRUD & ACTION HANDLERS
 * ----------------------------------------------------------------
 */

// --- User CRUD (Admin) ---

function showCreateUserModal() {
    userForm.reset();
    document.getElementById('user-form-id').value = '';
    userFormTitle.textContent = 'Create New User';
    userFormModal.classList.remove('hidden');
}

async function showEditUserModal(id) {
    try {
        const user = await apiFetch(`/people/${id}`);
        userForm.reset();
        userFormTitle.textContent = 'Edit User';
        document.getElementById('user-form-id').value = user.id;
        document.getElementById('user-form-name').value = user.name;
        document.getElementById('user-form-address').value = user.address;
        document.getElementById('user-form-age').value = user.age;
        userFormModal.classList.remove('hidden');
    } catch (error) {
        alert('Failed to load user data: ' + error.message);
    }
}

async function handleUserFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('user-form-id').value;

    const personDetailsDTO = {
        name: document.getElementById('user-form-name').value,
        address: document.getElementById('user-form-address').value,
        age: parseInt(document.getElementById('user-form-age').value)
    };

    try {
        if (id) {
            // Update (PUT) - include ID in the body
            personDetailsDTO.id = id;
            await apiFetch(`/people/${id}`, {
                method: 'PUT',
                body: JSON.stringify(personDetailsDTO)
            });
        } else {
            // Create (POST) - According to the API schema, PersonDetailsDTO requires id
            // We need to generate it client-side
            personDetailsDTO.id = crypto.randomUUID();
            await apiFetch('/people', {
                method: 'POST',
                body: JSON.stringify(personDetailsDTO)
            });
        }
        userFormModal.classList.add('hidden');
        loadAllUsers(); // Refresh list
        loadMyInfo(); // Refresh personal info if admin edits self
    } catch (error) {
        alert('Failed to save user: ' + error.message);
    }
}

async function handleDeleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        // First, check if the user has any assigned devices
        const userDevices = await apiFetch(`/devices/user/${id}`);

        if (userDevices && userDevices.length > 0) {
            alert('Cannot delete user: Please unassign all devices from this user before removing it.');
            return;
        }

        // If no devices assigned, proceed with deletion
        await apiFetch(`/auth/delete/${id}`, { method: 'DELETE' });
        alert('User deleted.');
        loadAllUsers(); // Refresh list
    } catch (error) {
        console.error('Delete user error:', error);
        // Check if error is related to assigned devices
        if (error.message.toLowerCase().includes('device') ||
            error.message.toLowerCase().includes('assigned') ||
            error.message.toLowerCase().includes('constraint') ||
            error.message.toLowerCase().includes('foreign key')) {
            alert('Cannot delete user: Please unassign all devices from this user before removing it.');
        } else {
            alert('Failed to delete user: ' + error.message);
        }
    }
}

// --- Device CRUD (Admin) ---

function showCreateDeviceModal() {
    deviceForm.reset();
    document.getElementById('device-form-id').value = '';
    deviceFormTitle.textContent = 'Create New Device';
    deviceFormModal.classList.remove('hidden');
}

async function showEditDeviceModal(id) {
    try {
        const device = await apiFetch(`/devices/${id}`);
        deviceForm.reset();
        deviceFormTitle.textContent = 'Edit Device';
        document.getElementById('device-form-id').value = device.id;
        document.getElementById('device-form-name').value = device.name;
        document.getElementById('device-form-manufacturer').value = device.manufacturer;
        document.getElementById('device-form-consumption').value = device.consumption;
        deviceFormModal.classList.remove('hidden');
    } catch (error) {
        alert('Failed to load device data: ' + error.message);
    }
}

async function handleDeviceFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('device-form-id').value;

    const deviceDetailsDTO = {
        name: document.getElementById('device-form-name').value,
        manufacturer: document.getElementById('device-form-manufacturer').value,
        consumption: parseInt(document.getElementById('device-form-consumption').value)
    };

    if (deviceDetailsDTO.consumption < 0) {
        alert('Consumption cannot be negative.');
        return;
    }

    try {
        if (id) {
            // Update (PUT) - include ID in the body for update
            deviceDetailsDTO.id = id;
            await apiFetch(`/devices/${id}`, {
                method: 'PUT',
                body: JSON.stringify(deviceDetailsDTO)
            });
        } else {
            // Create (POST) - don't include ID
            await apiFetch('/devices', {
                method: 'POST',
                body: JSON.stringify(deviceDetailsDTO)
            });
        }
        deviceFormModal.classList.add('hidden');
        loadAllDevices(); // Refresh list
    } catch (error) {
        alert('Failed to save device: ' + error.message);
    }
}

async function handleDeleteDevice(id) {
    if (!confirm('Are you sure you want to delete this device?')) return;

    try {
        // First, check if the device is assigned to any user
        const assignedUserId = await apiFetch(`/devices/user-mapping/${id}`, {}, 'text');

        if (assignedUserId && assignedUserId.trim() !== '') {
            alert('Cannot delete device: Please unassign this device from all users before removing it.');
            return;
        }

        // If not assigned, proceed with deletion
        await apiFetch(`/devices/${id}`, { method: 'DELETE' });
        alert('Device deleted.');
        loadAllDevices(); // Refresh list
    } catch (error) {
        console.error('Delete device error:', error);
        // Check if error is related to device assignment
        if (error.message.toLowerCase().includes('user') ||
            error.message.toLowerCase().includes('assigned') ||
            error.message.toLowerCase().includes('constraint') ||
            error.message.toLowerCase().includes('foreign key') ||
            error.message.toLowerCase().includes('mapping')) {
            alert('Cannot delete device: Please unassign this device from all users before removing it.');
        } else {
            alert('Failed to delete device: ' + error.message);
        }
    }
}

// --- Device Assignment (Admin) ---

function showAssignDeviceModal(deviceId) {
    assignDeviceForm.reset();
    document.getElementById('assign-device-id').value = deviceId;

    // Populate user dropdown from cache
    const userSelect = document.getElementById('user-select-dropdown');
    userSelect.innerHTML = '<option value="">-- Select a User --</option>'; // Reset
    allUsersCache.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.name} (ID: ${user.id})`;
        userSelect.appendChild(option);
    });

    assignDeviceModal.classList.remove('hidden');
}

async function handleAssignDeviceSubmit(e) {
    e.preventDefault();
    const deviceId = document.getElementById('assign-device-id').value;
    const selectedUserId = document.getElementById('user-select-dropdown').value;

    if (!selectedUserId) {
        alert('Please select a user.');
        return;
    }

    try {
        await apiFetch(`/devices/mapping?userId=${selectedUserId}&deviceId=${deviceId}`, {
            method: 'POST'
        });
        alert('Device assigned successfully.');
        assignDeviceModal.classList.add('hidden');
        loadAllDevices(); // Refresh list to show new assignment
    } catch (error) {
        alert('Failed to assign device: ' + error.message);
    }
}

async function handleUnassignDevice(deviceId, userIdToUnassign) {
    if (!confirm(`Are you sure you want to unassign this device from user ${userIdToUnassign}?`)) return;

    try {
        await apiFetch(`/devices/mapping?userId=${userIdToUnassign}&deviceId=${deviceId}`, {
            method: 'DELETE'
        });
        alert('Device unassigned successfully.');
        loadAllDevices(); // Refresh list
    } catch (error) {
        alert('Failed to unassign device: ' + error.message);
    }
}

// --- View Device Details (Client) ---

let currentChart = null;
let currentWs = null;

async function handleViewDeviceDetails(id, ownerId) {
    try {
        const device = await apiFetch(`/devices/${id}`);
        const content = document.getElementById('view-device-details-content');

        // Set default date to today
        const today = new Date().toISOString().split('T')[0];

        content.innerHTML = `
            <div class="details-header">
                <p><strong>ID:</strong> ${device.id}</p>
                <p><strong>Name:</strong> ${device.name}</p>
                <p><strong>Manufacturer:</strong> ${device.manufacturer}</p>
                <p><strong>Max Consumption:</strong> ${device.consumption} kWh</p>
                <p><strong>Owner ID:</strong> ${ownerId}</p>
            </div>
            
            <div class="real-time-section" style="margin: 20px 0; padding: 10px; background: #f0f8ff; border-radius: 5px;">
                <h4>Real-Time Consumption</h4>
                <p style="font-size: 1.2em;">Current Value: <strong id="rt-value">Waiting for data...</strong> kWh</p>
            </div>

            <div class="history-section" style="margin-top: 20px;">
                <h4>Historical Consumption</h4>
                <label for="history-date">Select Date:</label>
                <input type="date" id="history-date" value="${today}">
                <div style="position: relative; height: 300px; width: 100%; margin-top: 10px;">
                    <canvas id="consumption-chart"></canvas>
                </div>
            </div>
        `;

        viewDeviceDetailsModal.classList.remove('hidden');

        // Initialize Chart
        const ctx = document.getElementById('consumption-chart').getContext('2d');
        if (currentChart) {
            currentChart.destroy();
        }

        currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Array.from({ length: 24 }, (_, i) => i + ':00'),
                datasets: [{
                    label: 'Energy Consumption (kWh)',
                    data: new Array(24).fill(0),
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'kWh'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Hour of Day'
                        }
                    }
                }
            }
        });

        // Fetch initial data
        await updateChartData(id, today);

        // Date picker listener
        document.getElementById('history-date').addEventListener('change', (e) => {
            updateChartData(id, e.target.value);
        });

        // --- WebSocket Setup ---
        setupWebSocket(ownerId, id);

    } catch (error) {
        alert('Failed to load device details: ' + error.message);
    }
}

async function updateChartData(deviceId, date) {
    try {
        // Assuming the monitoring service is on port 8000 and accessible via proxy or direct
        // Since apiFetch uses window.API_BASE_URL, we might need to adjust if monitoring is on a different port/path
        // For this setup, I'll assume /monitoring prefix is proxied or we use a direct URL if needed.
        // However, the current apiFetch points to the main backend. 
        // If monitoring is a separate service, we need its URL.
        // Based on file structure, it seems like a microservices setup.
        // I will assume for now that the API gateway routes /monitoring requests to the monitoring service.

        console.log(`Fetching history for ${deviceId} on ${date}`);
        const data = await apiFetch(`/monitoring/history/${deviceId}?date=${date}`);
        console.log("Received history data:", data);

        // Reset data
        const hourlyData = new Array(24).fill(0);

        if (data && Array.isArray(data)) {
            data.forEach(item => {
                if (item.hour >= 0 && item.hour < 24) {
                    hourlyData[item.hour] = item.value;
                }
            });
        }

        currentChart.data.datasets[0].data = hourlyData;
        currentChart.update();
        currentChart.data.datasets[0].data = hourlyData;
        currentChart.update();

    } catch (error) {
        console.error("Failed to fetch history:", error);
    }
}

/**
 * ----------------------------------------------------------------
 * ðŸ’¬ CHAT FUNCTIONALITY
 * ----------------------------------------------------------------
 */

function setupChatWebSocket(userId) {
    if (chatWs) {
        chatWs.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // /ws/chat/{userId}
    const wsUrl = `${protocol}//${host}/ws/chat/${userId}`;

    console.log("[Chat] Connecting to Chat WS:", wsUrl, "for role:", userRole);
    chatWs = new WebSocket(wsUrl);

    chatWs.onopen = () => {
        console.log("[Chat] WebSocket Connected for user:", userId, "role:", userRole);
    };

    chatWs.onmessage = (event) => {
        try {
            let data = event.data;
            try {
                data = JSON.parse(data);
            } catch (e) {
                // If not JSON, treat as text
            }

            if (typeof data === 'object' && data.type === 'chat') {
                console.log('[Chat] Received message:', { text: data.text.substring(0, 30), sender: data.sender, user_id: data.user_id }, 'My role:', userRole);

                // Determine if this is our own message echo
                const isOwnMessage = (
                    (userRole === 'ROLE_ADMIN' && data.sender === 'admin') ||
                    (userRole !== 'ROLE_ADMIN' && data.sender === 'user')
                );

                // Create a unique key for deduplication: "sender:text"
                const msgKey = `${data.sender}:${data.text}`;

                // Skip if this is an echo of a message WE just sent
                // We only block echo if WE sent it (isOwnMessage) AND it's in our recent list
                if (isOwnMessage && recentlySentMessages.has(msgKey)) {
                    console.log('[Chat] Skipping own message echo:', data.text.substring(0, 20));
                    return;
                }

                // Determine how to display based on sender and current user role
                let displayAs = 'other'; // default

                if (userRole === 'ROLE_ADMIN') {
                    // Admin view:
                    // - 'user' messages are from the customer → display as 'other' (left/gray)
                    // - 'admin' messages are from this admin → display as 'user' (right/blue)
                    // - 'assistant' or 'system' messages → display as 'other'
                    if (data.sender === 'admin') {
                        displayAs = 'user';
                    } else {
                        displayAs = 'other';
                    }
                } else {
                    // Regular user view:
                    // - 'user' messages are from this user → display as 'user' (right/blue)
                    // - 'admin' or 'assistant' messages are responses → display as 'other' (left/gray)
                    if (data.sender === 'user') {
                        displayAs = 'user';
                    } else {
                        displayAs = 'other';
                    }
                }

                addMessageToChat(data.text, displayAs);
            } else if (typeof data === 'object' && data.type === 'alert') {
                console.log("[Alert] Received alert:", data.message);
                alert(data.message); // Simple browser alert as requested
            } else if (typeof data === 'string') {
                addMessageToChat(data, 'other');
            }

        } catch (e) {
            console.error("Chat WS Error:", e);
        }
    };

    chatWs.onclose = () => {
        console.log("Chat WS Closed");
    };
}

function toggleChatWindow() {
    chatWindow.classList.toggle('hidden');
    const isVisible = !chatWindow.classList.contains('hidden');

    if (isVisible) {
        chatInput.focus();
        scrollToBottom();

        // Connect if not connected
        if (!chatWs || chatWs.readyState === WebSocket.CLOSED) {
            let targetId = userId;
            if (userRole === 'ROLE_ADMIN') {
                if (currentChatTargetUserId) {
                    targetId = currentChatTargetUserId;
                    setupChatWebSocket(targetId);
                }
            } else {
                setupChatWebSocket(targetId);
            }
        }
    } else {
        // Closing window - disconnect
        if (chatWs) {
            console.log("[Chat] Window closed, closing WebSocket.");
            chatWs.close();
            chatWs = null;
        }
    }
}

async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Clear input immediately for better UX
    chatInput.value = '';

    // If Admin, ensure we have a target
    if (userRole === 'ROLE_ADMIN' && !currentChatTargetUserId) {
        addMessageToChat("Error: No chat target selected.", 'other');
        return;
    }

    // Add to UI immediately for the sender
    addMessageToChat(text, 'user');

    // Track this message to avoid displaying duplicate when echo arrives
    // Key format: "sender:text" to distinguish between different senders
    const senderType = (userRole === 'ROLE_ADMIN') ? 'admin' : 'user';
    const msgKey = `${senderType}:${text}`;
    recentlySentMessages.add(msgKey);
    console.log('[Chat] Sent message, tracking:', msgKey.substring(0, 40));
    // Remove from tracking after 3 seconds (longer than typical echo delay)
    setTimeout(() => {
        recentlySentMessages.delete(msgKey);
    }, 3000);

    // 2. Send to Backend via REST
    // We send to /chat endpoint which forwards to Chat Service
    try {
        await apiFetch('/chat/message', {
            method: 'POST',
            body: JSON.stringify({
                user_id: userRole === 'ROLE_ADMIN' && currentChatTargetUserId ? currentChatTargetUserId : userId,
                text: text,
                sender: userRole === 'ROLE_ADMIN' ? 'admin' : 'user'
            })
        });
        // Response will come via WebSocket
    } catch (error) {
        console.error("Failed to send chat message:", error);
        addMessageToChat("Error: Could not send message.", 'other');
    }
}

function addMessageToChat(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setupWebSocket(userId, deviceId) {
    if (currentWs) {
        currentWs.close();
    }

    // Determine WS URL
    // Use window.location to determine host and protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // Includes port if present

    // Construct URL: wss://localhost/ws/{userId}/{deviceId}
    // This assumes Nginx is proxying /ws to the monitoring service
    const wsUrl = `${protocol}//${host}/ws/${userId}/${deviceId}`;

    console.log("Connecting to WS:", wsUrl);
    currentWs = new WebSocket(wsUrl);

    currentWs.onopen = () => {
        console.log("WS Connected");
    };

    currentWs.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // Expecting { device_id, user_id, timestamp, measurement_value }
            if (data.measurement_value !== undefined) {
                document.getElementById('rt-value').textContent = data.measurement_value;

                // Update chart if looking at today
                if (currentChart) {
                    const selectedDate = document.getElementById('history-date').value;
                    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

                    if (selectedDate === today) {
                        const timestamp = new Date(data.timestamp);
                        // The chart expects 0-23 hours. 
                        // If the backend timestamp is UTC, the browser converts it to local here (new Date).
                        // However, we should ensure consistent day/hour extraction.
                        // Assuming the user wants to see data in their local time:
                        const hour = timestamp.getHours();

                        if (hour >= 0 && hour < 24) {
                            // Add the measurement value to the current hour's total
                            // Note: The chart data is cumulative for the hour in the backend (SUM),
                            // and the WS sends the increment (measurement_value).
                            // So we add it to the existing value in the chart.
                            const currentVal = eval(currentChart.data.datasets[0].data[hour]) || 0; // ensure number
                            currentChart.data.datasets[0].data[hour] = currentVal + data.measurement_value;
                            currentChart.update();
                        }
                    }
                }
            }
        } catch (e) {
            console.error("WS Message Error:", e);
        }
    };

    currentWs.onclose = () => {
        console.log("WS Closed");
    };

    currentWs.onerror = (err) => {
        console.error("WS Error:", err);
    };
}

// Hook into modal close to clean up WS
document.querySelector('.close-button[data-modal="view-device-details-modal"]').addEventListener('click', () => {
    if (currentWs) {
        currentWs.close();
        currentWs = null;
    }
});

/**
 * ----------------------------------------------------------------
 * ðŸ› ï¸ UTILITY & API HELPER
 * ----------------------------------------------------------------
 */

/**
 * A simple JWT parser.
 * This is NOT for validation, only for reading the payload.
 */
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Failed to parse JWT:", e);
        return null;
    }
}

/**
 * Centralized API fetch wrapper.
 * - Adds Authorization header.
 * - Sets JSON Content-Type for POST/PUT.
 * - Handles non-OK responses.
 * - Parses JSON by default, or returns text.
 */
async function apiFetch(endpoint, options = {}, responseType = 'json') {
    // Use API_BASE_URL from window object if set, otherwise use relative paths
    // This allows for flexible deployment behind Nginx proxy
    const API_BASE_URL = window.API_BASE_URL || '';
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    // Don't set Content-Type for Basic Auth
    if (config.headers['Authorization'] && config.headers['Authorization'].startsWith('Basic')) {
        delete config.headers['Content-Type'];
    }

    const response = await fetch(API_BASE_URL + endpoint, config);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
    }

    if (response.status === 204 || response.status === 201) {
        // No content or Created with no body
        return null;
    }

    if (responseType === 'text') {
        return response.text();
    }

    // Check if response has content before trying to parse JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return response.json();
    }

    // If no JSON content-type, try to get text
    const text = await response.text();
    return text || null;
}
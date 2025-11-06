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
        }
    });
    
    // Client: View Device Details
    clientDeviceListContainer.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (target && target.classList.contains('view-device-details-btn')) {
            handleViewDeviceDetails(target.dataset.id);
        }
    });
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
    } else { // ROLE_USER
        userGreeting.textContent = `Welcome, User!`;
        clientSection.classList.remove('hidden');
        loadClientData();
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
function loadAdminData() {
    loadAllUsers();
    loadAllDevices();
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
            if (assignedUserId) {
                assignmentButton = `
                    <button class="unassign-device-btn secondary" data-id="${device.id}" data-userid="${assignedUserId}">
                        Unassign
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

async function handleViewDeviceDetails(id) {
    try {
        const device = await apiFetch(`/devices/${id}`);
        const content = document.getElementById('view-device-details-content');
        content.innerHTML = `
            <p><strong>ID:</strong> ${device.id}</p>
            <p><strong>Name:</strong> ${device.name}</p>
            <p><strong>Manufacturer:</strong> ${device.manufacturer}</p>
            <p><strong>Max Consumption:</strong> ${device.consumption} kWh</p>
        `;
        viewDeviceDetailsModal.classList.remove('hidden');
    } catch (error) {
        alert('Failed to load device details: ' + error.message);
    }
}

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
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
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
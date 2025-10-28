document.addEventListener('DOMContentLoaded', () => {
    // --- STATE AND ELEMENTS ---
    const pages = {
        login: document.getElementById('login-page'),
        register: document.getElementById('register-page'),
        client: document.getElementById('client-dashboard'),
        admin: document.getElementById('admin-dashboard'),
    };

    const logoutButton = document.getElementById('logout-button');

    // Forms
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const userForm = document.getElementById('user-form');
    const deviceForm = document.getElementById('device-form');
    const mappingForm = document.getElementById('mapping-form');

    // Links
    const showRegisterLink = document.getElementById('show-register-link');
    const showLoginLink = document.getElementById('show-login-link');

    // Error messages
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
    const mappingMessage = document.getElementById('mapping-message');

    // Admin Table Bodies
    const userTableBody = document.getElementById('user-table-body');
    const deviceTableBody = document.getElementById('device-table-body');

    // Admin Mapping Selects
    const userSelect = document.getElementById('mapping-user-select');
    const deviceSelect = document.getElementById('mapping-device-select');
    
    // Admin Mapping Buttons
    const assignButton = document.getElementById('assign-device-button');
    const unassignButton = document.getElementById('unassign-device-button');

    // Client device list
    const clientDevicesList = document.getElementById('client-devices-list');

    // --- HELPER FUNCTIONS ---

    /**
     * Shows a specific page and hides all others
     * @param {string} pageId - The key of the page to show (e.g., 'login', 'admin')
     */
    function showPage(pageId) {
        Object.values(pages).forEach(page => page.classList.remove('active'));
        if (pages[pageId]) {
            pages[pageId].classList.add('active');
        }
    }

    /**
     * Parses a JWT token to get its payload.
     * @param {string} token - The JWT string
     * @returns {object | null} The decoded payload or null if invalid
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
     * Gets standard authentication headers for API requests
     * @returns {HeadersInit}
     */
    function getAuthHeaders() {
        const token = localStorage.getItem('jwtToken');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Handles API fetch errors and displays them
     * @param {Response} response - The fetch response
     * @param {HTMLElement} errorElement - The element to display the error in
     */
    async function handleApiError(response, errorElement) {
        const errorText = await response.text();
        errorElement.textContent = `Error ${response.status}: ${errorText || response.statusText}`;
        console.error("API Error:", errorText);
    }

    // --- AUTHENTICATION ---

    /**
     * Handles user login
     */
    async function login(e) {
        e.preventDefault();
        loginError.textContent = '';
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            // POST /auth/token
            // Requires Basic Auth
            const response = await fetch('/auth/token', {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + btoa(`${username}:${password}`)
                }
            });

            if (response.ok) {
                const token = await response.text(); // Response is a plain text JWT
                localStorage.setItem('jwtToken', token);
                checkLoginState(); // Reload UI
            } else {
                handleApiError(response, loginError);
            }
        } catch (err) {
            loginError.textContent = 'Network error. Please try again.';
            console.error(err);
        }
    }

    /**
     * Handles new user registration
     */
    async function register(e) {
        e.preventDefault();
        registerError.textContent = '';

        // Build RegisterDTO from form
        const registerDTO = {
            username: document.getElementById('reg-username').value,
            password: document.getElementById('reg-password').value,
            name: document.getElementById('reg-name').value,
            address: document.getElementById('reg-address').value || null,
            age: parseInt(document.getElementById('reg-age').value) || null,
        };

        try {
            // POST /auth/register
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registerDTO)
            });

            if (response.status === 201) { // 201 Created
                alert('Registration successful! Please log in.');
                showPage('login');
                registerForm.reset();
            } else {
                handleApiError(response, registerError);
            }
        } catch (err) {
            registerError.textContent = 'Network error. Please try again.';
            console.error(err);
        }
    }

    /**
     * Logs the user out
     */
    function logout() {
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userRole');
        logoutButton.style.display = 'none';
        showPage('login');
    }

/**
     * Checks login state on page load
     */
    function checkLoginState() {
        const token = localStorage.getItem('jwtToken');
        if (!token) {
            showPage('login');
            return;
        }

        const payload = parseJwt(token);
        if (!payload) {
            logout(); // Bad token
            return;
        }

        // --- FINAL VERSION ---

        // 1. Get the Role
        const userRole = payload.scope; // Reads "ROLE_ADMIN" or "ROLE_CLIENT"

        // 2. Get the User ID
        // This is the key change: We are now reading the 'userId' claim
        // which you added to the token.
        const userId = payload.userId; // Reads the UUID

        if (!userId || !userRole) {
            console.error("JWT payload is missing 'userId' or 'scope' (for role)");
            logout();
            return;
        }
        
        localStorage.setItem('userId', userId);
        localStorage.setItem('userRole', userRole);

        logoutButton.style.display = 'block';

        // Role-based routing
        if (userRole === 'ROLE_ADMIN') {
            showPage('admin');
            loadAdminDashboard();
        } else {
            // This will now work, as 'userId' is the required UUID
            showPage('client');
            loadClientDashboard(userId); 
        }
        // --- END: FINAL VERSION ---
    }


    // --- CLIENT DASHBOARD ---

    /**
     * Fetches and displays devices for a specific user
     * @param {string} userId - The client's UUID
     */
    async function loadClientDashboard(userId) {
        clientDevicesList.innerHTML = '<p>Loading devices...</p>';
        try {
            // GET /devices/user/{userId}
            const response = await fetch(`/devices/user/${userId}`, {
                method: 'GET',
                headers: getAuthHeaders()
            });

            if (response.ok) {
                const devices = await response.json(); // Body: List<DeviceDTO>
                renderClientDevices(devices);
            } else {
                clientDevicesList.innerHTML = `<p class="error-message">Could not load devices.</p>`;
            }
        } catch (err) {
            clientDevicesList.innerHTML = `<p class="error-message">Network error.</p>`;
            console.error(err);
        }
    }

    /**
     * Renders device cards for the client
     * @param {Array<object>} devices - List of DeviceDTOs
     */
    function renderClientDevices(devices) {
        if (devices.length === 0) {
            clientDevicesList.innerHTML = '<p>You have no devices assigned to your account.</p>';
            return;
        }
        clientDevicesList.innerHTML = '';
        devices.forEach(device => {
            const card = document.createElement('div');
            card.className = 'device-card';
            card.innerHTML = `
                <h3>${device.name}</h3>
                <p><strong>ID:</strong> ${device.id}</p>
                <p><strong>Max Consumption:</strong> ${device.consumption} kWh</p>
            `;
            clientDevicesList.appendChild(card);
        });
    }

    // --- ADMIN DASHBOARD ---

    /**
     * Fetches all data needed for the admin dashboard
     */
    function loadAdminDashboard() {
        fetchUsers();
        fetchDevices();
    }

    // Admin: Fetch Users
    async function fetchUsers() {
        try {
            // GET /people
            const response = await fetch('/people', { headers: getAuthHeaders() });
            if (response.ok) {
                const users = await response.json(); // Body: List<PersonDTO>
                renderUserTable(users);
                populateUserSelect(users); // For mapping
            } else {
                userTableBody.innerHTML = `<tr><td colspan="4" class="error-message">Failed to load users</td></tr>`;
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Admin: Fetch Devices
    async function fetchDevices() {
        try {
            // GET /devices
            const response = await fetch('/devices', { headers: getAuthHeaders() });
            if (response.ok) {
                const devices = await response.json(); // Body: List<DeviceDTO>
                renderDeviceTable(devices);
                populateDeviceSelect(devices); // For mapping
            } else {
                deviceTableBody.innerHTML = `<tr><td colspan="4" class="error-message">Failed to load devices</td></tr>`;
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Admin: Render User Table
    function renderUserTable(users) {
        userTableBody.innerHTML = '';
        users.forEach(user => { // user is PersonDTO
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.age}</td>
                <td class="action-buttons">
                    <button class="edit-btn" data-id="${user.id}">Edit</button>
                    <button class="delete-btn" data-id="${user.id}">Delete</button>
                </td>
            `;
            userTableBody.appendChild(row);
        });
        // Add event listeners for new buttons
        document.querySelectorAll('#user-table .delete-btn').forEach(btn => btn.addEventListener('click', deleteUser));
        // TODO: Add listener for edit buttons
    }

    // Admin: Render Device Table
    function renderDeviceTable(devices) {
        deviceTableBody.innerHTML = '';
        devices.forEach(device => { // device is DeviceDTO
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${device.id}</td>
                <td>${device.name}</td>
                <td>${device.consumption}</td>
                <td class="action-buttons">
                    <button class="edit-btn" data-id="${device.id}">Edit</button>
                    <button class="delete-btn" data-id="${device.id}">Delete</button>
                </td>
            `;
            deviceTableBody.appendChild(row);
        });
        // Add event listeners for new buttons
        document.querySelectorAll('#device-table .delete-btn').forEach(btn => btn.addEventListener('click', deleteDevice));
        // TODO: Add listener for edit buttons
    }

    // Admin: Populate Mapping Selects
    function populateUserSelect(users) {
        userSelect.innerHTML = '<option value="">-- Select User --</option>';
        users.forEach(user => {
            userSelect.innerHTML += `<option value="${user.id}">${user.name} (ID: ...${user.id.slice(-6)})</option>`;
        });
    }
    function populateDeviceSelect(devices) {
        deviceSelect.innerHTML = '<option value="">-- Select Device --</option>';
        devices.forEach(device => {
            deviceSelect.innerHTML += `<option value="${device.id}">${device.name} (ID: ...${device.id.slice(-6)})</option>`;
        });
    }

    // Admin: Handle User Form (Create/Update)
    async function handleUserForm(e) {
        e.preventDefault();
        // Uses PersonDetailsDTO
        const personDetails = {
            id: document.getElementById('user-id').value || null, // API might need ID even for create
            name: document.getElementById('user-name').value,
            address: document.getElementById('user-address').value,
            age: parseInt(document.getElementById('user-age').value)
        };

        // This example only implements CREATE (POST). Update (PUT) would be similar.
        // For simplicity, we assume if no ID, it's a create.
        if (!personDetails.id) { 
            try {
                // POST /people
                const response = await fetch('/people', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(personDetails)
                });
                if (response.status === 201) { // 201 Created
                    alert('User created!');
                    userForm.reset();
                    fetchUsers(); // Refresh table
                } else {
                    alert(`Error: ${await response.text()}`);
                }
            } catch (err) { console.error(err); }
        } else {
            // TODO: Implement PUT /people/{id} for updates
            alert('Update functionality not fully implemented in this demo.');
        }
    }

    // Admin: Handle Device Form (Create/Update)
    async function handleDeviceForm(e) {
        e.preventDefault();
        // Uses DeviceDetailsDTO
        const deviceDetails = {
            id: document.getElementById('device-id').value || null,
            name: document.getElementById('device-name').value,
            manufacturer: document.getElementById('device-manufacturer').value,
            consumption: parseInt(document.getElementById('device-consumption').value)
        };

        if (!deviceDetails.id) {
            try {
                // POST /devices
                const response = await fetch('/devices', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(deviceDetails)
                });
                if (response.status === 201) { // 201 Created
                    alert('Device created!');
                    deviceForm.reset();
                    fetchDevices(); // Refresh table
                } else {
                    alert(`Error: ${await response.text()}`);
                }
            } catch (err) { console.error(err); }
        } else {
            // TODO: Implement PUT /devices/{id} for updates
            alert('Update functionality not fully implemented in this demo.');
        }
    }

    // Admin: Delete User
    async function deleteUser(e) {
        const id = e.target.dataset.id;
        if (!confirm(`Are you sure you want to delete user ${id}?`)) return;

        try {
            // DELETE /people/{id}
            const response = await fetch(`/people/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (response.status === 204) { // 204 No Content
                alert('User deleted.');
                fetchUsers(); // Refresh table
            } else {
                alert(`Error: ${await response.text()}`);
            }
        } catch (err) { console.error(err); }
    }

    // Admin: Delete Device
    async function deleteDevice(e) {
        const id = e.target.dataset.id;
        if (!confirm(`Are you sure you want to delete device ${id}?`)) return;

        try {
            // DELETE /devices/{id}
            const response = await fetch(`/devices/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (response.status === 204) { // 204 No Content
                alert('Device deleted.');
                fetchDevices(); // Refresh table
            } else {
                alert(`Error: ${await response.text()}`);
            }
        } catch (err) { console.error(err); }
    }

    // Admin: Assign Device
    async function assignDevice() {
        const userId = userSelect.value;
        const deviceId = deviceSelect.value;
        if (!userId || !deviceId) {
            mappingMessage.textContent = 'Please select a user AND a device.';
            return;
        }
        mappingMessage.textContent = '';

        try {
            // POST /devices/mapping
            const response = await fetch(`/devices/mapping?userId=${userId}&deviceId=${deviceId}`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (response.status === 201) { // 201 Created
                mappingMessage.textContent = 'Device assigned successfully!';
                mappingMessage.className = 'success-message';
            } else {
                mappingMessage.textContent = `Error: ${await response.text()}`;
                mappingMessage.className = 'error-message';
            }
        } catch (err) { console.error(err); }
    }

    // Admin: Unassign Device
    async function unassignDevice() {
        const userId = userSelect.value;
        const deviceId = deviceSelect.value;
        if (!userId || !deviceId) {
            mappingMessage.textContent = 'Please select a user AND a device.';
            return;
        }
        mappingMessage.textContent = '';

        try {
            // DELETE /devices/mapping
            const response = await fetch(`/devices/mapping?userId=${userId}&deviceId=${deviceId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (response.status === 204) { // 204 No Content
                mappingMessage.textContent = 'Device unassigned successfully!';
                mappingMessage.className = 'success-message';
            } else {
                mappingMessage.textContent = `Error: ${await response.text()}`;
                mappingMessage.className = 'error-message';
            }
        } catch (err) { console.error(err); }
    }


    // --- INITIALIZATION ---
    
    // Page switching links
    showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); showPage('register'); });
    showLoginLink.addEventListener('click', (e) => { e.preventDefault(); showPage('login'); });

    // Auth Listeners
    loginForm.addEventListener('submit', login);
    registerForm.addEventListener('submit', register);
    logoutButton.addEventListener('click', logout);

    // Admin Form Listeners
    userForm.addEventListener('submit', handleUserForm);
    deviceForm.addEventListener('submit', handleDeviceForm);
    document.getElementById('clear-user-form').addEventListener('click', () => userForm.reset());
    document.getElementById('clear-device-form').addEventListener('click', () => deviceForm.reset());

    // Admin Mapping Listeners
    assignButton.addEventListener('click', assignDevice);
    unassignButton.addEventListener('click', unassignDevice);

    // Initial check
    checkLoginState();
});

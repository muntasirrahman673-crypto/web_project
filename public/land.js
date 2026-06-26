// API Base URL
const API_URL = 'http://localhost:5000/api';

let dynamicAuthState = "login";

// Switch between login and signup
function switchAuthState(state) {
    dynamicAuthState = state;
    
    const tabLogin = document.getElementById("tabLogin");
    const tabSignup = document.getElementById("tabSignup");
    const formTitle = document.getElementById("formTitle");
    const formSubtitle = document.getElementById("formSubtitle");
    const signupFields = document.getElementById("signupFields");
    const submitBtn = document.getElementById("submitBtn");

    tabLogin.classList.remove("active");
    tabSignup.classList.remove("active");

    if (state === "signup") {
        tabSignup.classList.add("active");
        formTitle.innerText = "Create Account";
        formSubtitle.innerText = "Register your account. Admin approval required for access.";
        signupFields.classList.add("visible");
        document.getElementById("fullName").setAttribute("required", "true");
        submitBtn.innerHTML = `<span>Register Account</span> <i class="fas fa-user-plus"></i>`;
    } else {
        tabLogin.classList.add("active");
        formTitle.innerText = "Welcome Back";
        formSubtitle.innerText = "Please enter your institutional credentials to gain access.";
        signupFields.classList.remove("visible");
        document.getElementById("fullName").removeAttribute("required");
        submitBtn.innerHTML = `<span>Access Gateway</span> <i class="fas fa-arrow-right"></i>`;
    }
}

// Handle authentication submit
async function handleAuthSubmit(event) {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const selectedRole = document.querySelector('input[name="portalRole"]:checked').value;

    if (dynamicAuthState === "signup") {
        const fullName = document.getElementById("fullName").value;
        
        if (!fullName || !email || !password) {
            showNotificationToast("Please fill in all fields.", "error");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: fullName,
                    email: email,
                    password: password,
                    role: selectedRole
                })
            });

            const data = await response.json();

            if (data.success) {
                showNotificationToast(data.message || "Registration successful! Please wait for admin approval.", "success");
                setTimeout(() => {
                    switchAuthState('login');
                    document.getElementById("authForm").reset();
                }, 2000);
            } else {
                showNotificationToast(data.message || "Registration failed", "error");
            }
        } catch (error) {
            console.error('Registration error:', error);
            showNotificationToast("Connection error. Please try again.", "error");
        }
    } else {
        // Login - DON'T send role parameter
        if (!email || !password) {
            showNotificationToast("Please enter email and password.", "error");
            return;
        }

        try {
            // Remove the role from login request - backend doesn't need it
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    password: password
                    // Don't send role - backend ignores it anyway
                })
            });

            const data = await response.json();
            console.log('Login response:', data); // Debug log

            if (data.success) {
                // Store token and user info
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Get the user's name properly (could be name or full_name)
                const userName = data.user.name || data.user.full_name || 'User';
                showNotificationToast(`Welcome ${userName}! Redirecting...`, "success");
                
                // Redirect based on role
                setTimeout(() => {
                    const userRole = data.user.role;
                    console.log('Redirecting to:', userRole); // Debug log
                    
                    switch (userRole) {
                        case 'admin':
                            window.location.href = 'admin.html';
                            break;
                        case 'supervisor':
                            window.location.href = 'super.html';
                            break;
                        case 'researcher':
                            window.location.href = 'res.html';
                            break;
                        case 'student':
                            window.location.href = 'student.html';
                            break;
                        default:
                            console.error('Unknown role:', userRole);
                            window.location.href = 'land.html';
                    }
                }, 1500);
            } else {
                showNotificationToast(data.message || "Login failed", "error");
            }
        } catch (error) {
            console.error('Login error:', error);
            showNotificationToast("Connection error. Please check if server is running.", "error");
        }
    }
}

// Show notification toast
function showNotificationToast(msg, type = "info") {
    const toast = document.createElement("div");
    toast.className = "toast-alert";
    toast.style.backgroundColor = type === "error" ? "#ef4444" : type === "success" ? "#10b981" : "#1f2937";
    toast.innerText = msg;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Check if already logged in
function checkAuthAndRedirect() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (token && user.role) {
        console.log('Already logged in, redirecting to:', user.role);
        // Redirect to appropriate dashboard
        switch (user.role) {
            case 'admin': 
                window.location.href = 'admin.html'; 
                break;
            case 'supervisor': 
                window.location.href = 'super.html'; 
                break;
            case 'researcher': 
                window.location.href = 'res.html'; 
                break;
            case 'student': 
                window.location.href = 'student.html'; 
                break;
            default:
                // Clear invalid session
                localStorage.removeItem('token');
                localStorage.removeItem('user');
        }
    }
}

// Set up event listeners
document.addEventListener("DOMContentLoaded", () => {
    console.log('Landing page loaded');
    
    // Set up tab event listeners
    const tabLogin = document.getElementById("tabLogin");
    const tabSignup = document.getElementById("tabSignup");
    const authForm = document.getElementById("authForm");
    
    if (tabLogin) tabLogin.addEventListener("click", () => switchAuthState("login"));
    if (tabSignup) tabSignup.addEventListener("click", () => switchAuthState("signup"));
    if (authForm) authForm.addEventListener("submit", handleAuthSubmit);
    
    // Check if already logged in
    checkAuthAndRedirect();
});
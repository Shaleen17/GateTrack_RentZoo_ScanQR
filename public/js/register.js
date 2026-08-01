// register.js — Handles driver registration and login

const API_BASE = '';

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3500);
}

// Registration form
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const vehicleNo = document.getElementById('vehicleNo').value.trim();

    if (!name || !phone || !vehicleNo) {
        showToast('Please fill all fields', 'error');
        return;
    }

    if (phone.length !== 10) {
        showToast('Phone number must be 10 digits', 'error');
        return;
    }

    const btn = document.getElementById('register-btn');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');
    btn.disabled = true;
    btnText.textContent = 'Registering...';
    btnSpinner.style.display = 'inline-block';

    try {
        const res = await fetch(`${API_BASE}/api/drivers/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, vehicleNo })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Registration successful! Redirecting...', 'success');
            localStorage.setItem('driverId', data.driver._id);
            localStorage.setItem('driverName', data.driver.name);
            localStorage.setItem('driverPhone', data.driver.phone);
            setTimeout(() => {
                window.location.href = `/driver.html?id=${data.driver._id}`;
            }, 1000);
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (err) {
        showToast('Network error. Please try again.', 'error');
        console.error(err);
    } finally {
        btn.disabled = false;
        btnText.textContent = 'Register';
        btnSpinner.style.display = 'none';
    }
});

// Login form
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('login-phone').value.trim();

    if (!phone || phone.length !== 10) {
        showToast('Enter a valid 10-digit phone number', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/drivers/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('driverId', data.driver._id);
            localStorage.setItem('driverName', data.driver.name);
            localStorage.setItem('driverPhone', data.driver.phone);
            showToast(`Welcome back, ${data.driver.name}!`, 'success');
            setTimeout(() => {
                window.location.href = `/driver.html?id=${data.driver._id}`;
            }, 800);
        } else {
            showToast(data.error || 'Driver not found', 'error');
        }
    } catch (err) {
        showToast('Network error. Please try again.', 'error');
        console.error(err);
    }
});

// Check if already logged in
window.addEventListener('load', () => {
    const driverId = localStorage.getItem('driverId');
    if (driverId) {
        // Pre-fill login phone
        const phone = localStorage.getItem('driverPhone');
        if (phone) {
            document.getElementById('login-phone').value = phone;
        }
    }
});

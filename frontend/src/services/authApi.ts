
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export interface User {
    id: string
    full_name: string
    email: string
    is_active: boolean
    created_at: string
}

export interface RegisterData {
    full_name: string
    email: string
    password: string
}

export interface LoginData {
    email: string
    password: string
}

async function request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    })

    if (!response.ok) {
        let message = 'Something went wrong. Please try again.'

        try {
            const data = await response.json()
            message = data.detail || data.message || message
        } catch {
            // Keep the default error message.
        }

        throw new Error(
            typeof message === 'string' ? message : JSON.stringify(message)
        )
    }

    if (response.status === 204) {
        return undefined as T
    }

    return response.json() as Promise<T>
}

function getCookie(name: string): string | null {
    const cookie = document.cookie
        .split('; ')
        .find((item) => item.startsWith(`${name}=`))

    return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : null
}

export const authApi = {
    register(data: RegisterData) {
        return request<{ user: User; message?: string }>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    },

    login(data: LoginData) {
        return request<{ user: User; message?: string }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    },

    logout() {
        const csrfToken = getCookie('csrf_token')

        return request<void>('/api/auth/logout', {
            method: 'POST',
            headers: csrfToken
                ? { 'X-CSRF-Token': csrfToken }
                : {},
        })
    },

    getCurrentUser() {
        return request<User>('/api/auth/me', {
            method: 'GET',
        })
    },

    changePassword(data: {
        current_password: string
        new_password: string
    }) {
        const csrfToken = getCookie('csrf_token')

        return request<{ message?: string }>('/api/auth/change-password', {
            method: 'POST',
            headers: csrfToken
                ? { 'X-CSRF-Token': csrfToken }
                : {},
            body: JSON.stringify(data),
        })
    },
}

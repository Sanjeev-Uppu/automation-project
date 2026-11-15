
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from 'react'

import {
    authApi,
    type LoginData,
    type RegisterData,
    type User,
} from '../services/authApi'

interface AuthContextType {
    user: User | null
    loading: boolean
    isAuthenticated: boolean
    login: (data: LoginData) => Promise<void>
    register: (data: RegisterData) => Promise<void>
    logout: () => Promise<void>
    refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
    children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    const refreshUser = useCallback(async () => {
        try {
            const currentUser = await authApi.getCurrentUser()
            setUser(currentUser)
        } catch {
            setUser(null)
        }
    }, [])

    useEffect(() => {
        let mounted = true

        async function initializeAuth() {
            try {
                const currentUser = await authApi.getCurrentUser()

                if (mounted) {
                    setUser(currentUser)
                }
            } catch {
                if (mounted) {
                    setUser(null)
                }
            } finally {
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        initializeAuth()

        return () => {
            mounted = false
        }
    }, [])

    const login = async (data: LoginData) => {
        await authApi.login(data)
        await refreshUser()

        // A successful login should establish the session.
        const currentUser = await authApi.getCurrentUser()
        setUser(currentUser)
    }

    const register = async (data: RegisterData) => {
        await authApi.register(data)

        // Registration may or may not automatically log the user in.
        try {
            const currentUser = await authApi.getCurrentUser()
            setUser(currentUser)
        } catch {
            setUser(null)
        }
    }

    const logout = async () => {
        try {
            await authApi.logout()
        } finally {
            setUser(null)
        }
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                isAuthenticated: !!user,
                login,
                register,
                logout,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)

    if (!context) {
        throw new Error('useAuth must be used inside AuthProvider')
    }

    return context
}

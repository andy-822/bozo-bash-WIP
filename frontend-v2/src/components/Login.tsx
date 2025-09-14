'use client';

import {useState} from 'react';
import {Chrome, Trophy, HandFist} from 'lucide-react';
import {useUser} from '@/contexts/UserContext';
import {Button} from '@/components/ui/button';

export default function Login() {
    const [isLoading, setIsLoading] = useState(false);
    const {signInWithGoogle} = useUser();

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        try {
            await signInWithGoogle();
        } catch (error) {
            console.error('Login error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="max-w-md w-full rounded-lg p-8 border">
                <h1 className="text-2xl font-bold  mb-2">Bozo Bash</h1>
                <Button
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600 mr-3"></div>
                            Signing in...
                        </>
                    ) : (
                        <>
                            <Chrome className="h-5 w-5 mr-3"/>
                            Continue with Google
                        </>
                    )}
                </Button>
            </div>

        </div>
        // <div className="min-h-screen flex items-center justify-center px-4">
        //   <div className="max-w-md w-full bg-gray-800 rounded-lg p-8 border border-gray-700">
        //     <div className="text-center mb-8">
        //       <div className="bg-blue-600 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        //         <Trophy className="h-8 w-8 text-white" />
        //       </div>
        //       <h1 className="text-2xl font-bold text-white mb-2">Welcome to The Bozos</h1>
        //       <p className="text-gray-400">Join the parlay challenge with your friends</p>
        //     </div>
        //
        //     <div className="space-y-6">
        //       <div className="text-center">
        //         <p className="text-sm text-gray-400 mb-6">
        //           Sign in with your Google account to get started
        //         </p>
        //       </div>
        //
        //       <button
        //         onClick={handleGoogleSignIn}
        //         disabled={isLoading}
        //         className={`w-full flex items-center justify-center py-3 px-4 rounded-lg font-semibold transition-colors ${
        //           isLoading
        //             ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
        //             : 'bg-white hover:bg-gray-100 text-gray-900'
        //         } border-2 border-transparent focus:border-blue-500`}
        //       >
        //         {isLoading ? (
        //           <>
        //             <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600 mr-3"></div>
        //             Signing in...
        //           </>
        //         ) : (
        //           <>
        //             <Chrome className="h-5 w-5 mr-3" />
        //             Continue with Google
        //           </>
        //         )}
        //       </button>
        //
        //       <div className="text-center">
        //         <p className="text-xs text-gray-500">
        //           We&apos;ll create your profile automatically using your Google account
        //         </p>
        //       </div>
        //     </div>
        //
        //   </div>
        // </div>
    );
}
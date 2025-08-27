import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function HomePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If user is authenticated, redirect to dashboard
  if (user) {
    redirect('/dashboard');
  }
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Los Pinos</h1>
          <h2 className="text-xl text-gray-600 mt-2">Invoice Analyzer</h2>
          <p className="mt-4 text-gray-500">
            Comprehensive vendor invoice price analysis system
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total Invoices:</span>
              <span className="font-semibold">361</span>
            </div>
            <div className="flex justify-between">
              <span>Total Value:</span>
              <span className="font-semibold">$420,581.48</span>
            </div>
            <div className="flex justify-between">
              <span>Unique Products:</span>
              <span className="font-semibold">191</span>
            </div>
            <div className="flex justify-between">
              <span>Time Coverage:</span>
              <span className="font-semibold">14 months</span>
            </div>
            <div className="flex justify-between">
              <span>Locations:</span>
              <span className="font-semibold">Bee Caves, 360</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Link 
            href="/auth/signin"
            className="block w-full text-white text-center py-3 px-4 rounded-md hover:opacity-90 transition duration-200"
            style={{ backgroundColor: '#f29d2c' }}
          >
            Sign In to Dashboard
          </Link>
          
          <Link 
            href="/auth/signup"
            className="block w-full bg-gray-600 text-white text-center py-3 px-4 rounded-md hover:bg-gray-700 transition duration-200"
          >
            Create Account
          </Link>
          
          <div className="text-center text-sm text-gray-500">
            <p>🚀 Data Import Phase: COMPLETE</p>
            <p>🔄 UI Development Phase: IN PROGRESS</p>
          </div>
        </div>
      </div>
    </div>
  );
}
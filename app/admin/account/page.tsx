'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function AdminAccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [staffRow, setStaffRow] = useState<any>(null);

  const [profile, setProfile] = useState({ firstName: '', lastName: '', phone: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
        return;
      }
      if (cancelled) return;
      setUser(session.user);
      setProfile({
        firstName: session.user.user_metadata?.first_name || '',
        lastName: session.user.user_metadata?.last_name || '',
        phone: session.user.user_metadata?.phone || session.user.phone || '',
      });

      const { data: staff } = await supabase
        .from('staff')
        .select('id, role, is_active, full_name, phone')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (cancelled) return;
      setStaffRow(staff || null);
      // Prefer staff row's name/phone when present so they stay in sync
      // with what other admins see in the Staff list.
      if (staff) {
        const parts = (staff.full_name || '').split(' ');
        setProfile(prev => ({
          ...prev,
          firstName: prev.firstName || parts[0] || '',
          lastName: prev.lastName || parts.slice(1).join(' ') || '',
          phone: prev.phone || staff.phone || '',
        }));
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [router]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });
    setProfileLoading(true);
    try {
      const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: profile.firstName,
          last_name: profile.lastName,
          phone: profile.phone,
        },
      });
      if (authError) throw authError;

      // Mirror the profile fields onto the staff row so the admin Staff
      // list reflects edits made here.
      if (staffRow?.id) {
        const { error: staffError } = await supabase
          .from('staff')
          .update({ full_name: fullName || null, phone: profile.phone || null })
          .eq('id', staffRow.id);
        if (staffError) throw staffError;
      }
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err?.message || 'Failed to save profile.' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg({ type: '', text: '' });

    if (!pwd.current) {
      setPwdMsg({ type: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (pwd.next.length < 6) {
      setPwdMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (pwd.next !== pwd.confirm) {
      setPwdMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (pwd.next === pwd.current) {
      setPwdMsg({ type: 'error', text: 'New password must be different from the current one.' });
      return;
    }

    setPwdLoading(true);
    try {
      const email = user?.email;
      if (!email) throw new Error('Missing account email');
      // Re-authenticate with the current password to confirm identity.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: pwd.current,
      });
      if (signInError) throw new Error('Current password is incorrect');

      const { error } = await supabase.auth.updateUser({ password: pwd.next });
      if (error) throw error;
      setPwd({ current: '', next: '', confirm: '' });
      setPwdMsg({ type: 'success', text: 'Password updated successfully.' });
    } catch (err: any) {
      setPwdMsg({ type: 'error', text: err?.message || 'Failed to update password.' });
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <i className="ri-loader-4-line animate-spin text-3xl text-emerald-600"></i>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-500 mt-1">Manage your admin profile and password.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <aside className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-24">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-lg">
                {(user?.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {[profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Admin'}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
            <div className="mt-5 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Role</span>
                <span className="font-semibold text-gray-900 capitalize">
                  {staffRow?.role?.replace('_', ' ') || 'Super Admin'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Status</span>
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full ${
                    staffRow?.is_active === false
                      ? 'bg-red-100 text-red-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {staffRow?.is_active === false ? 'Inactive' : 'Active'}
                </span>
              </div>
            </div>
            <Link
              href="/admin"
              className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-emerald-500 hover:text-emerald-700 transition-colors"
            >
              <i className="ri-arrow-left-line"></i>
              Back to Dashboard
            </Link>
          </div>
        </aside>

        <main className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Profile Information</h2>
            <p className="text-sm text-gray-500 mb-6">Update your name and contact phone.</p>

            {profileMsg.text && (
              <div className={`mb-5 p-3 rounded-lg text-sm flex items-start gap-2 ${profileMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                <i className={`text-base mt-0.5 ${profileMsg.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}`}></i>
                {profileMsg.text}
              </div>
            )}

            <form onSubmit={handleProfileSave} className="space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">First Name</label>
                  <input
                    type="text"
                    value={profile.firstName}
                    onChange={e => setProfile({ ...profile, firstName: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={profile.lastName}
                    onChange={e => setProfile({ ...profile, lastName: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Email Address</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-3 border-2 border-gray-100 bg-gray-50 rounded-lg text-gray-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={e => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="+233 XX XXX XXXX"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={profileLoading}
                className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {profileLoading ? 'Saving…' : 'Save Profile'}
              </button>
            </form>
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Change Password</h2>
            <p className="text-sm text-gray-500 mb-6">
              We&apos;ll ask for your current password to confirm it&apos;s really you.
            </p>

            {pwdMsg.text && (
              <div className={`mb-5 p-3 rounded-lg text-sm flex items-start gap-2 ${pwdMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                <i className={`text-base mt-0.5 ${pwdMsg.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}`}></i>
                {pwdMsg.text}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Current Password</label>
                <div className="relative">
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={pwd.current}
                    onChange={e => setPwd({ ...pwd, current: e.target.value })}
                    autoComplete="current-password"
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Enter your current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                  >
                    <i className={`${showPasswords ? 'ri-eye-off-line' : 'ri-eye-line'} text-lg`}></i>
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">New Password</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={pwd.next}
                    onChange={e => setPwd({ ...pwd, next: e.target.value })}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="At least 6 characters"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Confirm New Password</label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={pwd.confirm}
                    onChange={e => setPwd({ ...pwd, confirm: e.target.value })}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={pwdLoading}
                className="px-6 py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pwdLoading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}

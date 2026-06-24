import React, { useState, useEffect } from 'react';
import type { AuthAdapter, AdminProfile } from '../adapters/authAdapter';
import { Key, Trash2, Shield, Plus, Copy, Check, AlertTriangle } from 'lucide-react';

interface PasskeyManagementProps {
  adminProfile: AdminProfile;
  authAdapter: AuthAdapter;
  onProfileUpdate: () => void;
}

export const PasskeyManagement: React.FC<PasskeyManagementProps> = ({
  adminProfile,
  authAdapter,
  onProfileUpdate
}) => {
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [backupPassphrase, setBackupPassphrase] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Super-admin states
  const [allAdmins, setAllAdmins] = useState<AdminProfile[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const isSuperAdmin = adminProfile.roles.superAdmin;

  useEffect(() => {
    if (isSuperAdmin) {
      loadAllAdmins();
    }
  }, [isSuperAdmin]);

  const loadAllAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const list = await authAdapter.listAllAdmins();
      setAllAdmins(list);
    } catch (err: any) {
      console.error('Failed to load admins list:', err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleRegisterPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyLabel.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setBackupPassphrase(null);

    try {
      const res = await authAdapter.registerPasskey(newKeyLabel.trim());
      setNewKeyLabel('');
      setSuccessMsg('Passkey successfully registered!');
      if (res.backupPassphrase) {
        setBackupPassphrase(res.backupPassphrase);
      }
      onProfileUpdate();
      if (isSuperAdmin) {
        loadAllAdmins();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to register passkey. Ensure your device supports biometric verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePasskey = async (id: string, label: string) => {
    if (adminProfile.passkeys.length === 1 && !backupPassphrase) {
      const confirmLast = window.confirm(
        `Warning: This is your last registered passkey. If you delete it, you will only be able to recover your account using your xkcd backup passphrase. Are you sure you want to proceed?`
      );
      if (!confirmLast) return;
    } else {
      const confirmDelete = window.confirm(`Are you sure you want to delete the passkey "${label}"?`);
      if (!confirmDelete) return;
    }

    setLoading(true);
    setError(null);
    try {
      await authAdapter.deletePasskey(id);
      setSuccessMsg('Passkey deleted successfully.');
      onProfileUpdate();
      if (isSuperAdmin) {
        loadAllAdmins();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to delete passkey.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAdminPasskeys = async (targetUid: string, targetEmail: string) => {
    const confirmRevoke = window.confirm(
      `Are you sure you want to revoke ALL passkeys and recovery credentials for instructor "${targetEmail}"? They will be locked out until they verify their email link on next login.`
    );
    if (!confirmRevoke) return;

    setLoading(true);
    try {
      await authAdapter.revokeAdminPasskeys(targetUid);
      setSuccessMsg(`Credentials for ${targetEmail} have been revoked.`);
      loadAllAdmins();
      onProfileUpdate();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to revoke admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPassphrase = () => {
    if (!backupPassphrase) return;
    navigator.clipboard.writeText(backupPassphrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Self-service Passkeys list */}
      <div className="glass-panel" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
          <Key size={18} className="text-secondary" />
          My Registered Passkeys
        </h3>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--accent-red)', borderRadius: 'var(--radius-sm)', padding: '10px', color: '#fff', fontSize: '0.85rem', marginBottom: '15px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertTriangle size={16} style={{ color: 'var(--accent-red)' }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid var(--accent-green)', borderRadius: 'var(--radius-sm)', padding: '10px', color: '#fff', fontSize: '0.85rem', marginBottom: '15px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Check size={16} style={{ color: 'var(--accent-green)' }} />
            <span>{successMsg}</span>
          </div>
        )}

        {backupPassphrase && (
          <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid var(--accent-green)', borderRadius: 'var(--radius-md)', padding: '15px', marginBottom: '20px', boxShadow: 'var(--shadow-neon-success)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-green)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>
              <Shield size={18} />
              NEW ACCOUNT RECOVERY PASSPHRASE
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Write this down in a secure place. If you lose your device or passkeys, this is the **only** way to regain access to your account.
            </p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
              <code style={{ fontSize: '1rem', color: '#fff', fontWeight: 'bold', letterSpacing: '0.05em', flex: 1, fontFamily: 'monospace' }}>
                {backupPassphrase}
              </code>
              <button 
                type="button" 
                onClick={handleCopyPassphrase}
                style={{ background: 'none', border: 'none', color: copied ? 'var(--accent-green)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {adminProfile.passkeys.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px dotted var(--border-glass)', textAlign: 'center' }}>
              <Shield size={24} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>No Passkeys Registered</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Register a passkey below to enable biometric sign-in.</div>
            </div>
          ) : (
            adminProfile.passkeys.map((key) => (
              <div key={key.id} style={{ display: 'flex', justifyItems: 'center', gap: '10px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', alignItems: 'center' }}>
                <Key size={16} style={{ color: 'var(--text-secondary)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>{key.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Registered: {new Date(key.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePasskey(key.id, key.label)}
                  disabled={loading}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                  title="Delete passkey"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add passkey form */}
        <form onSubmit={handleRegisterPasskey} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="Label (e.g., Mac Studio, Work Laptop)"
            value={newKeyLabel}
            onChange={(e) => setNewKeyLabel(e.target.value)}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-glass)',
              color: '#fff',
              fontSize: '0.85rem'
            }}
            required
          />
          <button
            type="submit"
            disabled={loading || !newKeyLabel.trim()}
            className="btn btn-primary"
            style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <Plus size={16} />
            Add Key
          </button>
        </form>
      </div>

      {/* Super-admin governance console */}
      {isSuperAdmin && (
        <div className="glass-panel" style={{ padding: '20px', borderTop: '2px solid var(--primary)' }}>
          <h3 style={{ fontSize: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Shield size={18} style={{ color: 'var(--primary)' }} />
            Super-Admin Governance Console
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
            Manage instructors, credentials, and access roles for the Antigravity Kanban Classroom.
          </p>

          {loadingAdmins ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '10px' }}>
              Loading instructors...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {allAdmins.map((adminUser) => (
                <div key={adminUser.uid} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>{adminUser.email}</span>
                      {adminUser.roles.superAdmin && (
                        <span style={{ marginLeft: '8px', fontSize: '0.65rem', backgroundColor: 'rgba(139, 92, 246, 0.2)', border: '1px solid var(--primary)', padding: '2px 6px', borderRadius: '10px', color: '#fff', fontWeight: 'bold' }}>
                          SUPER-ADMIN
                        </span>
                      )}
                    </div>
                    {adminUser.uid !== adminProfile.uid && (
                      <button
                        type="button"
                        onClick={() => handleRevokeAdminPasskeys(adminUser.uid, adminUser.email)}
                        disabled={loading}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.7rem', padding: '4px 8px', color: 'var(--accent-red)', border: '1px solid var(--accent-red)', background: 'none' }}
                      >
                        Revoke Credentials
                      </button>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '15px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    <span>Registered Keys: {adminUser.passkeys.length}</span>
                    <span>Status: {adminUser.passkeys.length > 0 ? '🟢 Passkeys Active' : '🟡 Recovery Mode (Email Link Required)'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

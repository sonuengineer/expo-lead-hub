import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, User, KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api-client";
import { useAuthStore } from "../stores/auth.store";

export function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const saveName = useMutation({
    mutationFn: () => api.auth.updateProfile({ name: name.trim() }),
    onSuccess: (res: any) => {
      const u = res?.data?.user;
      if (u && user) setUser({ ...user, name: u.name });
      toast.success("Name updated");
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Update failed"),
  });

  const savePassword = useMutation({
    mutationFn: () => api.auth.updateProfile({ currentPassword, newPassword }),
    onSuccess: () => {
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Password change failed"),
  });

  const submitPassword = () => {
    if (newPassword.length < 8) return toast.error("New password must be at least 8 characters");
    if (newPassword !== confirm) return toast.error("Passwords do not match");
    savePassword.mutate();
  };

  const input =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">My Account</h2>
        <p className="mt-1 text-sm text-gray-500">{user?.email}</p>
      </div>

      {/* Name */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Profile</h3>
        </div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Display name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => saveName.mutate()}
            disabled={saveName.isPending || name.trim().length < 2 || name.trim() === user?.name}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saveName.isPending && <Loader2 size={16} className="animate-spin" />}
            Save name
          </button>
        </div>
      </div>

      {/* Password */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Change password</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Current password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={input} autoComplete="current-password" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={input} autoComplete="new-password" />
            <p className="mt-1 text-xs text-gray-400">At least 8 characters.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Confirm new password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} autoComplete="new-password" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={submitPassword}
            disabled={savePassword.isPending || !currentPassword || !newPassword || !confirm}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {savePassword.isPending && <Loader2 size={16} className="animate-spin" />}
            Change password
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api-client";
import { Badge, formatDate } from "../components/badges";
import { useAuthStore } from "../stores/auth.store";

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "ADMIN" | "STAFF";
  isActive: boolean;
  createdAt: string;
}

const ROLE_STYLE: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-800",
  ADMIN: "bg-indigo-100 text-indigo-800",
  STAFF: "bg-gray-100 text-gray-700",
};

export function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "STAFF" });

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.users.list()).data,
    enabled: isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: () => api.users.create(form),
    onSuccess: (res: any) => {
      toast.success(
        res.data?.tempPassword
          ? `Created. Temp password: ${res.data.tempPassword}`
          : "User created",
        { duration: 8000 },
      );
      setShowCreate(false);
      setForm({ name: "", email: "", role: "STAFF" });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Create failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.users.update(id, data),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: () => toast.error("Update failed"),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.users.deactivate(id),
    onSuccess: () => {
      toast.success("User deactivated");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Failed"),
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => api.users.resetPassword(id),
    onSuccess: (res: any) =>
      toast.success(`New temporary password: ${res.data?.tempPassword}`, { duration: 12000 }),
    onError: () => toast.error("Password reset failed"),
  });

  if (!isSuperAdmin) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        User management is restricted to Super Admins.
      </div>
    );
  }

  const users: AppUser[] = data?.users ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="mt-1 text-sm text-gray-500">{users.length} users</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <UserPlus size={16} /> Add user
        </button>
      </div>

      {isError && <p className="text-red-600">Failed to load users.</p>}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "Email", "Role", "Status", "Created", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge label={u.role.replace("_", " ")} className={ROLE_STYLE[u.role]} />
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <Badge label="Active" className="bg-green-100 text-green-800" />
                      ) : (
                        <Badge label="Inactive" className="bg-gray-200 text-gray-600" />
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-500">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      {!isSelf && u.role !== "SUPER_ADMIN" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (confirm(`Reset password for ${u.name}? A new temporary password will be shown.`))
                                resetMutation.mutate(u.id);
                            }}
                            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                          >
                            Reset pw
                          </button>
                          {u.isActive ? (
                            <button
                              onClick={() => deactivateMutation.mutate(u.id)}
                              className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => updateMutation.mutate({ id: u.id, data: { isActive: true } })}
                              className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-50"
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add user</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {createMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

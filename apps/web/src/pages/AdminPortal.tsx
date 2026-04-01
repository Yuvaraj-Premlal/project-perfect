import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getAdminUsers, createAdminUser, updateAdminUser, deactivateAdminUser,
  getAdminDepartments, createDepartment, deleteDepartment,
  getAdminSuppliers, createAdminSupplier, updateAdminSupplier, deleteAdminSupplier
} from '../api/projects'

const ROLES = ['super_user', 'portfolio_manager', 'pm', 'visitor']
const ROLE_LABELS: Record<string,string> = {
  super_user: 'Super User', portfolio_manager: 'Portfolio Manager', pm: 'PM', visitor: 'Visitor'
}
const ROLE_COLORS: Record<string,string> = {
  super_user: 'red', portfolio_manager: 'blue', pm: 'green', visitor: 'amber'
}

type AdminTab = 'users' | 'departments' | 'suppliers'

export default function AdminPortal() {
  const [tab, setTab] = useState<AdminTab>('users')
  const qc = useQueryClient()

  // Users state
  const { data: users = [] }       = useQuery({ queryKey: ['admin-users'],       queryFn: getAdminUsers })
  const { data: departments = [] }  = useQuery({ queryKey: ['admin-departments'], queryFn: getAdminDepartments })
  const { data: suppliers = [] }    = useQuery({ queryKey: ['admin-suppliers'],   queryFn: () => getAdminSuppliers() })

  const [userModal, setUserModal]       = useState(false)
  const [editUser, setEditUser]         = useState<any>(null)
  const [supplierModal, setSupplierModal] = useState(false)
  const [editSupplier, setEditSupplier] = useState<any>(null)
  const [deptName, setDeptName]         = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  // User form state
  const [uEmail, setUEmail]         = useState('')
  const [uName, setUName]           = useState('')
  const [uRole, setURole]           = useState('pm')
  const [uDept, setUDept]           = useState('')
  const [uPhone, setUPhone]         = useState('')
  const [uPassword, setUPassword]   = useState('')

  // Supplier form state
  const [sName, setSName]   = useState('')
  const [sType, setSType]   = useState('supplier')
  const [sCName, setSCName] = useState('')
  const [sCEmail, setSCEmail] = useState('')
  const [sCPhone, setSCPhone] = useState('')

  function openNewUser() {
    setEditUser(null)
    setUEmail(''); setUName(''); setURole('pm'); setUDept(''); setUPhone(''); setUPassword('')
    setError(''); setUserModal(true)
  }

  function openEditUser(u: any) {
    setEditUser(u)
    setUEmail(u.email); setUName(u.full_name); setURole(u.role)
    setUDept(u.department_id || ''); setUPhone(u.contact_phone || ''); setUPassword('')
    setError(''); setUserModal(true)
  }

  async function saveUser() {
    setError(''); setSaving(true)
    try {
      const data = { email: uEmail, full_name: uName, role: uRole, department_id: uDept || null, contact_phone: uPhone || null, password: uPassword || undefined }
      if (editUser) await updateAdminUser(editUser.user_id, data)
      else await createAdminUser(data)
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setUserModal(false)
    } catch(e: any) {
      setError(e?.response?.data?.error || 'Failed to save user')
    } finally { setSaving(false) }
  }

  async function deactivateUser(id: string) {
    await deactivateAdminUser(id)
    qc.invalidateQueries({ queryKey: ['admin-users'] })
  }

  async function addDepartment() {
    if (!deptName.trim()) return
    await createDepartment({ name: deptName })
    setDeptName('')
    qc.invalidateQueries({ queryKey: ['admin-departments'] })
  }

  async function removeDepartment(id: string) {
    try {
      await deleteDepartment(id)
      qc.invalidateQueries({ queryKey: ['admin-departments'] })
    } catch(e: any) {
      alert(e?.response?.data?.error || 'Cannot delete department')
    }
  }

  function openNewSupplier() {
    setEditSupplier(null)
    setSName(''); setSType('supplier'); setSCName(''); setSCEmail(''); setSCPhone('')
    setError(''); setSupplierModal(true)
  }

  function openEditSupplier(s: any) {
    setEditSupplier(s)
    setSName(s.supplier_name); setSType(s.supplier_type)
    setSCName(s.contact_name || ''); setSCEmail(s.contact_email || ''); setSCPhone(s.contact_phone || '')
    setError(''); setSupplierModal(true)
  }

  async function saveSupplier() {
    setError(''); setSaving(true)
    try {
      const data = { supplier_name: sName, supplier_type: sType, contact_name: sCName, contact_email: sCEmail, contact_phone: sCPhone }
      if (editSupplier) await updateAdminSupplier(editSupplier.supplier_id, data)
      else await createAdminSupplier(data)
      qc.invalidateQueries({ queryKey: ['admin-suppliers'] })
      setSupplierModal(false)
    } catch(e: any) {
      setError(e?.response?.data?.error || 'Failed to save')
    } finally { setSaving(false) }
  }

  async function removeSupplier(id: string) {
    try {
      await deleteAdminSupplier(id)
      qc.invalidateQueries({ queryKey: ['admin-suppliers'] })
    } catch(e: any) {
      alert(e?.response?.data?.error || 'Cannot delete supplier')
    }
  }

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:4 }}>Admin Portal</div>
        <div style={{ fontSize:12, color:'var(--text3)' }}>Manage users, departments and suppliers</div>
      </div>

      <div className="tab-nav" style={{ marginBottom:20 }}>
        {(['users','departments','suppliers'] as AdminTab[]).map(t => (
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)} style={{ textTransform:'capitalize' }}>{t}</button>
        ))}
      </div>

      {/* USERS TAB */}
      {tab === 'users' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button className="tb-btn primary" onClick={openNewUser}>+ Add User</button>
          </div>
          <div className="card">
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)' }}>
                  {['Name','Email','Role','Department','Phone','Status','Actions'].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'8px 12px', fontSize:11, color:'var(--text3)', fontWeight:600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(users as any[]).map((u: any) => (
                  <tr key={u.user_id} style={{ borderBottom:'1px solid var(--border)', opacity: u.is_active ? 1 : 0.45 }}>
                    <td style={{ padding:'10px 12px', fontWeight:500, color:'var(--text)' }}>{u.full_name}</td>
                    <td style={{ padding:'10px 12px', color:'var(--text2)' }}>{u.email}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span className={`status ${ROLE_COLORS[u.role] || 'blue'}`}>{ROLE_LABELS[u.role] || u.role}</span>
                    </td>
                    <td style={{ padding:'10px 12px', color:'var(--text3)' }}>{u.department_name || '-'}</td>
                    <td style={{ padding:'10px 12px', color:'var(--text3)' }}>{u.contact_phone || '-'}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span className={`status ${u.is_active ? 'green' : 'red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="tb-btn" style={{ fontSize:11 }} onClick={() => openEditUser(u)}>Edit</button>
                        {u.is_active && <button className="tb-btn" style={{ fontSize:11, color:'var(--red)' }} onClick={() => deactivateUser(u.user_id)}>Deactivate</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {(users as any[]).length === 0 && (
                  <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:'var(--text4)' }}>No users yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEPARTMENTS TAB */}
      {tab === 'departments' && (
        <div style={{ maxWidth:500 }}>
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            <input className="form-input" placeholder="Department name" value={deptName} onChange={e => setDeptName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDepartment()} style={{ flex:1, fontSize:12 }} />
            <button className="tb-btn primary" onClick={addDepartment}>Add</button>
          </div>
          <div className="card">
            {(departments as any[]).length === 0 && (
              <div style={{ textAlign:'center', padding:40, color:'var(--text4)', fontSize:12 }}>No departments yet</div>
            )}
            {(departments as any[]).map((d: any) => (
              <div key={d.department_id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500, color:'var(--text)' }}>{d.name}</div>
                  <div style={{ fontSize:11, color:'var(--text4)' }}>{d.user_count} user(s)</div>
                </div>
                <button className="tb-btn" style={{ fontSize:11, color:'var(--red)' }} onClick={() => removeDepartment(d.department_id)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUPPLIERS TAB */}
      {tab === 'suppliers' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button className="tb-btn primary" onClick={openNewSupplier}>+ Add Supplier</button>
          </div>
          <div className="card">
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)' }}>
                  {['Name','Type','Contact Name','Email','Phone','Actions'].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'8px 12px', fontSize:11, color:'var(--text3)', fontWeight:600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(suppliers as any[]).map((s: any) => (
                  <tr key={s.supplier_id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'10px 12px', fontWeight:500, color:'var(--text)' }}>{s.supplier_name}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span className={`status ${s.supplier_type === 'supplier' ? 'blue' : 'amber'}`}>
                        {s.supplier_type === 'supplier' ? 'Supplier' : 'Sub-supplier'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 12px', color:'var(--text2)' }}>{s.contact_name || '-'}</td>
                    <td style={{ padding:'10px 12px', color:'var(--text2)' }}>{s.contact_email || '-'}</td>
                    <td style={{ padding:'10px 12px', color:'var(--text2)' }}>{s.contact_phone || '-'}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="tb-btn" style={{ fontSize:11 }} onClick={() => openEditSupplier(s)}>Edit</button>
                        <button className="tb-btn" style={{ fontSize:11, color:'var(--red)' }} onClick={() => removeSupplier(s.supplier_id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(suppliers as any[]).length === 0 && (
                  <tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:'var(--text4)' }}>No suppliers yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* USER MODAL */}
      {userModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="card" style={{ width:460, maxHeight:'90vh', overflowY:'auto' }}>
            <div className="card-header" style={{ marginBottom:16 }}>
              <div className="card-title">{editUser ? 'Edit User' : 'Add User'}</div>
              <button className="tb-btn" onClick={() => setUserModal(false)}>Close</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Full name</label>
                <input className="form-input" value={uName} onChange={e => setUName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={uEmail} onChange={e => setUEmail(e.target.value)} disabled={!!editUser} />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-input" value={uRole} onChange={e => setURole(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <select className="form-input" value={uDept} onChange={e => setUDept(e.target.value)}>
                  <option value="">No department</option>
                  {(departments as any[]).map((d: any) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Contact phone</label>
                <input className="form-input" value={uPhone} onChange={e => setUPhone(e.target.value)} />
              </div>
              {!editUser && (
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input className="form-input" type="password" value={uPassword}
                    onChange={e => setUPassword(e.target.value)}
                    placeholder="Min 8 characters" />
                </div>
              )}
              {editUser && (
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:12, marginTop:4 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>Reset Password</div>
                  <div className="form-group">
                    <label className="form-label">New password</label>
                    <input className="form-input" type="password" value={uPassword}
                      onChange={e => setUPassword(e.target.value)}
                      placeholder="Leave blank to keep current password" />
                  </div>
                  {uPassword && uPassword.length < 8 && (
                    <div style={{ fontSize:11, color:'var(--red)', marginTop:2 }}>Must be at least 8 characters</div>
                  )}
                </div>
              )}
              {error && <div style={{ fontSize:12, color:'var(--red)', background:'var(--red-bg)', borderRadius:6, padding:'8px 12px' }}>{error}</div>}
              <button className="tb-btn primary" onClick={saveUser} disabled={saving}>
                {saving ? 'Saving...' : editUser ? 'Save changes' : 'Create user'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER MODAL */}
      {supplierModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="card" style={{ width:460, maxHeight:'90vh', overflowY:'auto' }}>
            <div className="card-header" style={{ marginBottom:16 }}>
              <div className="card-title">{editSupplier ? 'Edit Supplier' : 'Add Supplier'}</div>
              <button className="tb-btn" onClick={() => setSupplierModal(false)}>Close</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-input" value={sName} onChange={e => setSName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={sType} onChange={e => setSType(e.target.value)}>
                  <option value="supplier">Supplier</option>
                  <option value="sub_supplier">Sub-supplier</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Contact name</label>
                <input className="form-input" value={sCName} onChange={e => setSCName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Contact email</label>
                <input className="form-input" type="email" value={sCEmail} onChange={e => setSCEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Contact phone</label>
                <input className="form-input" value={sCPhone} onChange={e => setSCPhone(e.target.value)} />
              </div>
              {error && <div style={{ fontSize:12, color:'var(--red)', background:'var(--red-bg)', borderRadius:6, padding:'8px 12px' }}>{error}</div>}
              <button className="tb-btn primary" onClick={saveSupplier} disabled={saving}>
                {saving ? 'Saving...' : editSupplier ? 'Save changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

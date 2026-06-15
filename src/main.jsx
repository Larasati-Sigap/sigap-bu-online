import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Users, Shield, ClipboardList, LogOut, Search, Plus, Save, Database, Activity, RotateCcw, Download, Pencil, Trash2, FileText } from 'lucide-react'
import { supabase } from './supabaseClient'
import './styles.css'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const units = ['Tata Usaha Pimpinan','Protokol & Pengamanan Pimpinan','Keamanan Dalam','Tata Usaha & Kearsipan','Sarana, Prasarana & Rumah Tangga','Asisten Khusus Jaksa Agung','Asisten Umum Jaksa Agung']
const emptyForm = { nama:'', nip_nrp:'', pangkat_gol:'', jabatan:'', unit_kerja:'Tata Usaha & Kearsipan', sub_unit:'', jenis:'TU', status:'Aktif', tmt_pangkat:'', tmt_jabatan:'', tanggal_pensiun:'', keterangan:'' }
const initials = (n='') => n.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'BU'
const statusClass = s => s === 'Naik Pangkat' ? 'naik' : s === 'Mutasi' ? 'mutasi' : s === 'Pensiun' ? 'pensiun' : 'aktif'
const pangkatTU = ['Yuana Darma (II/a)','Muda Darma (II/b)','Madya Darma (II/c)','Sena Darma (II/d)','Yuana Wira (III/a)','Muda Wira (III/b)','Madya Wira (III/c)','Sena Wira (III/d)','Adi Wira (IV/a)','Nindya Wira (IV/b)','Adi Adhyaksa (IV/c)','Nindya Adhyaksa (IV/d)','Utama Adhyaksa (IV/e)']
const pangkatJaksa = ['Ajun Jaksa Madya (III/a)','Ajun Jaksa (III/b)','Jaksa Pratama (III/c)','Jaksa Muda (III/d)','Jaksa Madya (IV/a)','Jaksa Utama Pratama (IV/b)','Jaksa Utama Muda (IV/c)','Jaksa Utama Madya (IV/d)','Jaksa Utama (IV/e)']

function Login() {
  const [email,setEmail]=useState(''), [password,setPassword]=useState(''), [msg,setMsg]=useState(''), [loading,setLoading]=useState(false)
  async function submit(e){ e.preventDefault(); setLoading(true); setMsg(''); const {error}=await supabase.auth.signInWithPassword({email,password}); if(error)setMsg(error.message); setLoading(false) }
  return <main className="loginScreen"><div className="loginGlow"/><form className="loginCard" onSubmit={submit}><div className="emblem">⚖</div><p className="eyebrow">Biro Umum</p><h1>SIGAP-BU</h1><p>Sistem Informasi Kepegawaian dan Administrasi Pegawai Biro Umum</p><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button className="btn primary full">{loading?'Masuk...':'Masuk Dashboard'}</button>{msg&&<div className="alert">{msg}</div>}<small>Akun dibuat via Supabase Authentication.</small></form></main>
}

function App(){
  const [session,setSession]=useState(null), [profile,setProfile]=useState(null), [pegawai,setPegawai]=useState([]), [history,setHistory]=useState([])
  const [active,setActive]=useState('dashboard'), [loading,setLoading]=useState(true), [q,setQ]=useState(''), [unit,setUnit]=useState(''), [status,setStatus]=useState(''), [jenis,setJenis]=useState('')
  const [modal,setModal]=useState(false), [editing,setEditing]=useState(null), [form,setForm]=useState(emptyForm)
  const [quick,setQuick]=useState({pegawai_id:'', tipe:'Naik Pangkat', jenis:'', pangkat_gol:'', unit_kerja:'Tata Usaha & Kearsipan', tanggal:new Date().toISOString().slice(0,10), catatan:''})
  const [users,setUsers]=useState([])
  const [satker,setSatker]=useState([])
  useEffect(()=>{ supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)}); const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return()=>data.subscription.unsubscribe() },[])
  useEffect(()=>{
  if(!session)return;

  loadAll();

  const ch = supabase.channel('sigap-realtime')
    .on('postgres_changes',{event:'*',schema:'public',table:'pegawai'},()=>{
      loadPegawai()
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'riwayat_perubahan'},()=>{
      loadHistory()
    })
    .subscribe();

  return()=>supabase.removeChannel(ch)

}, [session])

  async function loadSatker(){
    const {data}=await supabase
      .from('satker')
      .select('nama_satker,jenis,provinsi')
      .order('nama_satker',{ascending:true})
    setSatker(data||[])
  }
  async function loadAll(){ setLoading(true); await Promise.all([loadProfile(),loadPegawai(),loadHistory(),loadUsers(),loadSatker()]); setLoading(false) }
  async function loadProfile(){ const {data}=await supabase.from('profiles').select('*').eq('id',session.user.id).single(); setProfile(data) }
  async function loadPegawai(){ const {data}=await supabase.from('pegawai').select('*').order('urutan_pangkat',{ascending:false}); setPegawai(data||[]) }
  async function loadHistory(){ const {data}=await supabase.from('riwayat_perubahan').select('*').order('created_at',{ascending:false}).limit(100); setHistory(data||[]) }
  async function loadUsers(){
    const {data}=await supabase
      .from('profiles')
      .select('*')
      .order('nama')
    setUsers(data||[])
  }
  const role = profile?.role || 'viewer'
  const isSuperAdmin = role === 'super_admin'
  const isAdminUp = isSuperAdmin || role === 'admin_bagian'
  const canEdit = isAdminUp
  const ACCESS = {
  dashboard:true,
  pegawai:true,
  update:isAdminUp,
  mutasi:isAdminUp,
  pensiun:isAdminUp,
  riwayat:isAdminUp,
  backup:isSuperAdmin,
  users:isSuperAdmin
}
  const AccessDenied = ()=><section className="view"><article className="panel" style={{textAlign:'center',padding:'3rem'}}><p style={{fontSize:'1.2rem',color:'var(--danger,#e53e3e)'}}>🔒 Anda tidak memiliki hak akses ke fitur ini.</p></article></section>
  const filtered = useMemo(() =>
  pegawai.filter(p => {
    const keyword = [
      p.nama,
      p.nip_nrp,
      p.pangkat_gol,
      p.jabatan,
      p.unit_kerja
    ]
      .join(' ')
      .toLowerCase()

    const unitFilter = unit && unit !== 'Semua Bagian'
    const statusFilter = status && status !== 'Semua Status'
    const jenisFilter = jenis && jenis !== 'Jaksa/TU'

    return (
  (p.status || '').trim() !== 'Mutasi' &&
  (p.status || '').trim() !== 'Pensiun' &&
  keyword.includes(q.toLowerCase()) &&
  (!unitFilter || p.unit_kerja === unit) &&
  (!statusFilter || p.status === status) &&
  (!jenisFilter || p.jenis === jenis)
)
  }),
[pegawai,q,unit,status,jenis])

const dataMutasi = useMemo(() =>
  pegawai.filter(p => p.status === 'Mutasi'),
[pegawai])

const dataPensiun = useMemo(() =>
  pegawai.filter(p => p.status === 'Pensiun'),
[pegawai])
  const pegawaiAktif = pegawai.filter(
  p => p.status !== 'Mutasi' && p.status !== 'Pensiun'
)
  const stats = {
  total: pegawaiAktif.length,
  jaksa: pegawaiAktif.filter(p=>p.jenis==='Jaksa').length,
  tu: pegawaiAktif.filter(p=>p.jenis==='TU').length,
  pensiun: pegawai.filter(p=>p.status==='Pensiun').length,
  mutasi: pegawai.filter(p=>p.status==='Mutasi').length,
  pangkat: pegawaiAktif.filter(p=>p.status==='Naik Pangkat').length
}
const pensiunSatuTahun = pegawaiAktif
  .filter(p => {
    if (!p.tanggal_pensiun) return false

    const today = new Date()
    const target = new Date()
    target.setFullYear(today.getFullYear() + 1)

    const tglPensiun = new Date(p.tanggal_pensiun)

    return tglPensiun >= today && tglPensiun <= target
  })
  .sort((a,b) => new Date(a.tanggal_pensiun) - new Date(b.tanggal_pensiun))
  const naikPangkatTigaBulan = pegawaiAktif
  .filter(p => {
    if (!p.tmt_pangkat) return false

    const today = new Date()
    const target = new Date()
    target.setMonth(today.getMonth() + 3)

    const tmtPangkat = new Date(p.tmt_pangkat)

    return tmtPangkat >= today && tmtPangkat <= target
  })
  .sort((a,b) => new Date(a.tmt_pangkat) - new Date(b.tmt_pangkat))
  const ulangTahunBulanIni = pegawai
    .filter(p => {
      if (!p.tanggal_lahir) return false
      const tgl = new Date(p.tanggal_lahir)
      return tgl.getMonth() === new Date().getMonth()
    })
    .sort((a,b)=>{
      const hariA = new Date(a.tanggal_lahir).getDate()
      const hariB = new Date(b.tanggal_lahir).getDate()
      return hariA - hariB
    })

  const ulangTahunHariIni = pegawai.filter(p => {
    if (!p.tanggal_lahir) return false
    const tgl = new Date(p.tanggal_lahir)
    const sekarang = new Date()
    return (
      tgl.getDate() === sekarang.getDate() &&
      tgl.getMonth() === sekarang.getMonth()
    )
  })

  const unitCounts = Object.entries(
  pegawaiAktif.reduce((a,p)=>{
    if(unitBiroUmum.includes(p.unit_kerja)){
      a[p.unit_kerja]=(a[p.unit_kerja]||0)+1
    }
    return a
  },{})
).sort((a,b)=>b[1]-a[1])
  const unitBiroUmum = [
  'Keamanan Dalam',
  'Sarana, Prasarana & Rumah Tangga',
  'Protokol & Pengamanan Pimpinan',
  'Tata Usaha Pimpinan',
  'Tata Usaha & Kearsipan',
  'Asisten Khusus Jaksa Agung',
  'Asisten Umum Jaksa Agung'
]
  function openNew(){ setEditing(null); setForm(emptyForm); setModal(true) }
  function openEdit(p){ setEditing(p); setForm({...emptyForm,...p,tmt_pangkat:p.tmt_pangkat||'',tmt_jabatan:p.tmt_jabatan||'',tanggal_pensiun:p.tanggal_pensiun||''}); setModal(true) }
 async function addHistory(pegawai_id,tipe,field,oldValue,newValue,catatan,pegawaiNama=''){
  await supabase.from('riwayat_perubahan').insert({
    pegawai_id,
    tipe,
    field_diubah:field,
    nilai_lama:oldValue||'',
    nilai_baru:newValue||'',
    catatan:catatan||'',
    admin_id:session.user.id,
    admin_nama:profile?.nama||session.user.email,
    pegawai_nama:pegawaiNama
  })
}
  async function undoHistory(h){
  if(!confirm('Undo perubahan ini?')) return

  const payload = {
    [h.field_diubah]: h.nilai_lama
  }

  if(h.tipe === 'Mutasi'){
    payload.status = 'Aktif'
  }

  if(h.tipe === 'Pensiun'){
    payload.status = 'Aktif'
  }

  const { error } = await supabase
    .from('pegawai')
    .update(payload)
    .eq('id', h.pegawai_id)

  if(error){
    alert(error.message)
    return
  }

  await addHistory(
    h.pegawai_id,
    'UNDO',
    h.field_diubah,
    h.nilai_baru,
    h.nilai_lama,
    'Rollback data',
    h.pegawai_nama
  )

  await loadPegawai()
  await loadHistory()

  alert('Undo berhasil')
}
  async function savePegawai(e){ e.preventDefault(); if(!canEdit)return alert('Akun ini viewer.'); const payload={...form,tmt_pangkat:form.tmt_pangkat||null,tmt_jabatan:form.tmt_jabatan||null,tanggal_pensiun:form.tanggal_pensiun||null}; if(editing){ const {error}=await supabase.from('pegawai').update(payload).eq('id',editing.id); if(error)return alert(error.message); await addHistory(editing.id,'Edit Data Pegawai','status',editing.status,payload.status,form.keterangan,payload.nama) } else { const {data,error}=await supabase.from('pegawai').insert(payload).select().single(); if(error)return alert(error.message); await addHistory(data.id,'Tambah Pegawai','data_pegawai','',payload.status,form.keterangan,payload.nama) } setModal(false) }
  async function del(p){ if(profile?.role!=='super_admin')return alert('Hanya super admin.'); if(!confirm(`Hapus ${p.nama}?`))return; const {error}=await supabase.from('pegawai').delete().eq('id',p.id); if(error)return alert(error.message); await addHistory(p.id,'Hapus Data','data_pegawai',p.nama,'','Data dihapus') }
  async function quickUpdate(e){ e.preventDefault(); const p=pegawai.find(x=>x.id===quick.pegawai_id); if(!p)return alert('Pilih pegawai.'); if(quick.tipe==='Naik Pangkat'&&!quick.jenis)return alert('Pilih jenis pegawai terlebih dahulu.'); if(quick.tipe==='Naik Pangkat'&&!quick.pangkat_gol)return alert('Pilih pangkat/golongan baru.'); let payload={status:quick.tipe,keterangan:quick.catatan}, field='status', old=p.status, neu=quick.tipe; if(quick.tipe==='Naik Pangkat'){payload.pangkat_gol=quick.pangkat_gol;payload.jenis=quick.jenis;payload.tmt_pangkat=quick.tanggal||null;field='pangkat_gol';old=p.pangkat_gol;neu=payload.pangkat_gol} if(quick.tipe==='Mutasi'){
  payload.unit_kerja = quick.unit_kerja
  payload.status = 'Mutasi'
  field = 'unit_kerja'
  old = p.unit_kerja
  neu = quick.unit_kerja
} if(quick.tipe==='Pensiun')payload.tanggal_pensiun=quick.tanggal||null; const {error}=await supabase.from('pegawai').update(payload).eq('id',p.id); if(error)return alert(error.message); await addHistory(p.id,quick.tipe,field,old,neu,quick.catatan,p.nama); alert('Update berhasil.') }
  function exportCsv(){ const rows=pegawai.map(p=>[p.nama,p.jabatan,p.nip_nrp,p.pangkat_gol,p.unit_kerja,p.sub_unit,p.jenis,p.status,p.keterangan].map(v=>`"${String(v||'').replaceAll('"','""')}"`).join(',')); const blob=new Blob([['Nama,Jabatan,NIP/NRP,Pangkat/Gol,Unit Kerja,Sub Unit,Jenis,Status,Keterangan',...rows].join('\n')],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='sigap-bu-data-pegawai.csv'; a.click() }
 function exportPdf(){
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
  const now = new Date()
  const tgl = now.toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
  const adminNama = profile?.nama || session.user.email

  doc.setFontSize(14)
  doc.setFont('helvetica','bold')
  doc.text('DATA PEGAWAI BIRO UMUM', doc.internal.pageSize.getWidth()/2, 18, {align:'center'})

  doc.setFontSize(10)
  doc.setFont('helvetica','normal')
  doc.text('SIGAP-BU Online v3.0', doc.internal.pageSize.getWidth()/2, 25, {align:'center'})

  const cols = ['No','Nama','NIP/NRP','Jabatan','Pangkat/Gol','Unit Kerja','Status']
  const rows = filtered.map((p,i)=>[
    i+1,
    p.nama||'-',
    p.nip_nrp||'-',
    p.jabatan||'-',
    p.pangkat_gol||'-',
    p.unit_kerja||'-',
    p.status||'-'
  ])

  autoTable(doc,{
    head:[cols],
    body:rows,
    startY:30,
    styles:{fontSize:8, cellPadding:2},
    headStyles:{fillColor:[30,58,138], textColor:255, fontStyle:'bold'},
    alternateRowStyles:{fillColor:[239,246,255]},
    columnStyles:{
      0:{cellWidth:10,halign:'center'},
      1:{cellWidth:45},
      2:{cellWidth:30},
      3:{cellWidth:40},
      4:{cellWidth:25},
      5:{cellWidth:55},
      6:{cellWidth:22}
    },
    didDrawPage:(data)=>{
      const pageCount = doc.internal.getNumberOfPages()
      doc.setFontSize(8)
      doc.setFont('helvetica','normal')
      doc.text(`Dicetak: ${tgl} · Admin: ${adminNama}`, 14, doc.internal.pageSize.getHeight()-8)
      doc.text(`Halaman ${data.pageNumber} dari ${pageCount}`, doc.internal.pageSize.getWidth()-14, doc.internal.pageSize.getHeight()-8, {align:'right'})
    }
  })

  doc.save(`sigap-bu-pegawai-${now.toISOString().slice(0,10)}.pdf`)
}

  if(loading)return <div className="loading">Memuat SIGAP-BU...</div>
  if(!session)return <Login/>
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandLogo">⚖</div>
          <div><strong>SIGAP-BU</strong><span>Online v3.0</span></div>
        </div>
        <div className="userCard">
          <div className="avatar">{initials(profile?.nama||session.user.email)}</div>
          <div>
            <strong>{profile?.nama||session.user.email}</strong>
            <span>{profile?.role||'viewer'} · {profile?.unit_kerja||'Semua Unit'}</span>
          </div>
        </div>
        <p className="navTitle">NAVIGATION</p>
        {[['dashboard',Activity,'Dashboard'],['pegawai',Users,'Data Pegawai'],['update',RotateCcw,'Update Pegawai'],['mutasi',RotateCcw,'Mutasi'],['pensiun',Database,'Pensiun'],['riwayat',ClipboardList,'Audit Trail'],['backup',Database,'Backup'],['users',Users,'Manajemen User']].filter(([key])=>ACCESS[key]).map(([key,Icon,label])=><button key={key} className={`navItem ${active===key?'active':''}`} onClick={()=>setActive(key)}><Icon size={18}/>{label}</button>)}
        <button className="btn outline logout" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/>Keluar</button>
      </aside>
      <main className="main">
        <header className="hero">
          <div>
            <p className="breadcrumb">SIGAP-BU › {active}</p>
            <h2>{active==='dashboard'?'Dashboard SIGAP-BU':active==='pegawai'?'Data Pegawai':active==='update'?'Update Pegawai':active==='riwayat'?'Audit Trail':active==='users'?'Manajemen User':'Backup & Export'}</h2>
            <p>Data tersimpan di Supabase dan sinkron untuk seluruh user.</p>
          </div>
          <div className="heroActions">
            <button className="btn glass" onClick={exportCsv}><Download size={16}/>Export CSV</button>
            {isSuperAdmin&&<button className="btn glass" onClick={exportPdf}><FileText size={16}/>Export PDF</button>}
            {isSuperAdmin&&<button className="btn gold" onClick={openNew}><Plus size={16}/>Tambah Pegawai</button>}
          </div>
        </header>

        {active==='dashboard'&&(
          <section className="view">
            <div className="kpiGrid">
              <Kpi icon={<Users/>} label="Total Pegawai" value={stats.total}/>
              <Kpi icon={<Shield/>} label="Jaksa" value={stats.jaksa}/>
              <Kpi icon={<ClipboardList/>} label="Tata Usaha" value={stats.tu}/>
              <Kpi icon={<Database/>} label="Pensiun" value={stats.pensiun}/>
            </div>
            <div className="contentGrid">
              <article className="panel">
                <Title title="Distribusi Pegawai per Bagian" sub="Komposisi dari database pusat."/>
                <div className="bars">
                  {unitCounts.map(([u,c])=>(
                    <div className="barRow" key={u}>
                      <strong>{u}</strong>
                      <div className="barTrack">
                        <div className="barFill" style={{width:`${(c/Math.max(...unitCounts.map(x=>x[1]),1))*100}%`}}/>
                      </div>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </article>
              <article className="panel">
                <Title title="Monitoring Status" sub="Status perubahan berjalan."/>
                <div className="monitorMini">
                  <div><strong>{stats.pangkat}</strong><span>Naik Pangkat</span></div>
                  <div><strong>{stats.mutasi}</strong><span>Mutasi</span></div>
                  <div><strong>{stats.pensiun}</strong><span>Pensiun</span></div>
                </div>
              </article>
            </div>
            <article className="panel">
              <article className="panel">
  <Title title="⚠️ Menjelang Pensiun" sub="Pegawai yang akan pensiun dalam 1 tahun."/>
  {pensiunSatuTahun.length === 0 ? (
    <p className="note">Tidak ada pegawai yang akan pensiun dalam 1 tahun.</p>
  ) : (
    <div className="historyList">
      {pensiunSatuTahun.slice(0,5).map(p => (
        <div key={p.id} className="historyItem">
          <div className="historyIcon">⚠️</div>
          <div>
            <strong>{p.nama}</strong>
            <small>{p.jabatan || '-'} · Pensiun: {new Date(p.tanggal_pensiun).toLocaleDateString('id-ID')}</small>
          </div>
        </div>
      ))}
    </div>
  )}
</article>
              <article className="panel">
  <Title title="⬆️ Naik Pangkat" sub="Pegawai dengan TMT pangkat dalam 3 bulan."/>
  {naikPangkatTigaBulan.length === 0 ? (
    <p className="note">Tidak ada pegawai naik pangkat dalam 3 bulan.</p>
  ) : (
    <div className="historyList">
      {naikPangkatTigaBulan.slice(0,5).map(p => (
        <div key={p.id} className="historyItem">
          <div className="historyIcon">⬆️</div>
          <div>
            <strong>{p.nama}</strong>
            <small>{p.pangkat_gol || '-'} · TMT: {new Date(p.tmt_pangkat).toLocaleDateString('id-ID')}</small>
          </div>
        </div>
      ))}
    </div>
  )}
</article>
              <Title title="🎂 Ulang Tahun Pegawai" sub="Monitoring ulang tahun pegawai."/>
              {ulangTahunHariIni.length > 0 && (
                <div className="alert">
                  🎉 Ada {ulangTahunHariIni.length} pegawai yang berulang tahun hari ini!
                </div>
              )}
              {ulangTahunBulanIni.length === 0 ? (
                <p className="note">Tidak ada ulang tahun bulan ini.</p>
              ) : (
                <div className="historyList">
                  {ulangTahunBulanIni.map(p => (
                    <div key={p.id} className="historyItem">
                      <div className="historyIcon">🎂</div>
                      <div>
                        <strong>{p.nama}</strong>
                        <small>{new Date(p.tanggal_lahir).toLocaleDateString('id-ID')}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>
        )}

        {active==='pegawai'&&(
          <section className="view">
            <article className="panel">
              <Title title="Data Pegawai" sub="Cari, filter, edit, dan monitoring pegawai."/>
              <div className="filters">
                <div className="searchBox"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari nama, NIP, jabatan..."/></div>
                <select value={unit} onChange={e=>setUnit(e.target.value)}><option value="">Semua Bagian</option>{units.map(u=><option key={u}>{u}</option>)}</select>
                <select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Semua Status</option><option>Aktif</option><option>Naik Pangkat</option><option>Mutasi</option><option>Pensiun</option></select>
                <select value={jenis} onChange={e=>setJenis(e.target.value)}><option value="">Jaksa/TU</option><option>Jaksa</option><option>TU</option></select>
              </div>
              <div className="tableMeta">{filtered.length} data ditampilkan</div>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr><th>Nama Pegawai</th><th>NIP/NRP</th><th>Pangkat/Gol</th><th>Bagian</th><th>Jenis</th><th>Status</th><th>Aksi</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map(p=>(
                      <tr key={p.id}>
                        <td><div className="nameCell"><div className="miniAvatar">{initials(p.nama)}</div><div><strong>{p.nama}</strong><small>{p.jabatan||'-'}</small></div></div></td>
                        <td>{p.nip_nrp}</td>
                        <td>{p.pangkat_gol||'-'}</td>
                        <td>{p.unit_kerja||'-'}</td>
                        <td><span className={`badge ${p.jenis==='Jaksa'?'jaksa':'tu'}`}>{p.jenis}</span></td>
                        <td><span className={`badge ${statusClass(p.status)}`}>{p.status}</span></td>
                        <td>
                          <div className="actions">
                            {canEdit&&<button className="smallBtn edit" onClick={()=>openEdit(p)}><Pencil size={15}/></button>}
                            {profile?.role==='super_admin'&&<button className="smallBtn delete" onClick={()=>del(p)}><Trash2 size={15}/></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        )}

        {active==='update'&&(!ACCESS.update?<AccessDenied/>:(
          <section className="view">
            <article className="panel">
              <Title title="Update Naik Pangkat / Mutasi / Pensiun" sub="Setiap perubahan masuk audit trail."/>
              <form className="updateGrid" onSubmit={quickUpdate}>
                <label>Pilih Pegawai
                  <select value={quick.pegawai_id} onChange={e=>setQuick({...quick,pegawai_id:e.target.value})} required>
                    <option value="">Pilih pegawai</option>
                    {pegawai.map(p=><option value={p.id} key={p.id}>{p.nama} — {p.jabatan}</option>)}
                  </select>
                </label>
                <label>Jenis Update
                  <select value={quick.tipe} onChange={e=>setQuick({...quick,tipe:e.target.value,jenis:'',pangkat_gol:''})}>
                    <option>Naik Pangkat</option><option>Mutasi</option><option>Pensiun</option><option>Aktif</option>
                  </select>
                </label>
                {quick.tipe==='Naik Pangkat'&&(
                  <label>Jenis
                    <select value={quick.jenis} onChange={e=>setQuick({...quick,jenis:e.target.value,pangkat_gol:''})}>
                      <option value="">Pilih jenis</option>
                      <option value="TU">TU</option>
                      <option value="Jaksa">Jaksa</option>
                    </select>
                  </label>
                )}
                {quick.tipe==='Naik Pangkat'&&quick.jenis&&(
                  <label>Pangkat/Gol Baru
                    <select value={quick.pangkat_gol} onChange={e=>setQuick({...quick,pangkat_gol:e.target.value})}>
                      <option value="">Pilih pangkat/gol</option>
                      {(quick.jenis==='TU'?pangkatTU:pangkatJaksa).map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                )}
                <label>Unit Baru
                  {quick.tipe==='Mutasi'
                    ? <select value={quick.unit_kerja} onChange={e=>setQuick({...quick,unit_kerja:e.target.value})}>
                        <option value="">Pilih satker</option>
                        {satker.map(s=><option key={s.nama_satker} value={s.nama_satker}>{s.nama_satker} - {s.jenis} - {s.provinsi}</option>)}
                      </select>
                    : <select value={quick.unit_kerja} onChange={e=>setQuick({...quick,unit_kerja:e.target.value})}>
                        {units.map(u=><option key={u}>{u}</option>)}
                      </select>
                  }
                </label>
                <label>Tanggal/TMT
                  <input type="date" value={quick.tanggal} onChange={e=>setQuick({...quick,tanggal:e.target.value})}/>
                </label>
                <label className="fullRow">Catatan
                  <textarea value={quick.catatan} onChange={e=>setQuick({...quick,catatan:e.target.value})}/>
                </label>
                <button className="btn primary fullRow"><Save size={16}/>Simpan Update</button>
              </form>
            </article>
          </section>
        ))}
{active==='mutasi'&&(
  <section className="view">
    <article className="panel">
      <Title title="Data Mutasi" sub="Pegawai yang dimutasi"/>
      <p>Total: {dataMutasi.length} pegawai</p>
    </article>
  </section>
)}

{active==='pensiun'&&(
  <section className="view">
    <article className="panel">
      <Title title="Data Pensiun" sub="Pegawai yang pensiun"/>
      <p>Total: {dataPensiun.length} pegawai</p>
    </article>
  </section>
)}
        {active==='riwayat'&&(!ACCESS.riwayat?<AccessDenied/>:(
          <section className="view">
            <article className="panel">
              <Title title="Audit Trail" sub="Siapa mengubah, kapan, dan apa yang berubah."/>
              <History items={history} onUndo= {undoHistory}/>
            </article>
          </section>
        ))}

        {active==='backup'&&(!ACCESS.backup?<AccessDenied/>:(
          <section className="view">
            <article className="panel">
              <Title title="Backup & Export" sub="Export data dari Supabase."/>
              <button className="btn primary" onClick={exportCsv}><Download size={16}/>Download CSV</button>
              <p className="note">Import awal memakai SQL seed. Setelah online, update dilakukan langsung di aplikasi.</p>
            </article>
          </section>
        ))}

        {active==='users'&&(!ACCESS.users?<AccessDenied/>:(
          <section className="view usersView">
            <article className="panel">
              <Title title="Manajemen User" sub="Kelola akun dan role pengguna"/>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr><th>Nama</th><th>Role</th><th>Unit Kerja</th></tr>
                  </thead>
                  <tbody>
                    {users.map(u=>(
                      <tr key={u.id}>
                        <td>{u.nama}</td>
                        <td><span className="badge">{u.role}</span></td>
                        <td>{u.unit_kerja || 'Semua Unit'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        ))}

        {modal&&(
          <div className="modalBackdrop">
            <form className="modal" onSubmit={savePegawai}>
              <div className="modalHead">
                <div><p className="eyebrow blue">Form Pegawai</p><h3>{editing?'Edit Pegawai':'Tambah Pegawai'}</h3></div>
                <button type="button" className="xBtn" onClick={()=>setModal(false)}>×</button>
              </div>
              <div className="formGrid">
                {['nama','nip_nrp','pangkat_gol','jabatan','sub_unit'].map(k=>(
                  <label key={k}>{k.replaceAll('_',' ').toUpperCase()}<input value={form[k]||''} onChange={e=>setForm({...form,[k]:e.target.value})} required={k==='nama'||k==='nip_nrp'}/></label>
                ))}
                <label>Bagian<select value={form.unit_kerja} onChange={e=>setForm({...form,unit_kerja:e.target.value})}>{units.map(u=><option key={u}>{u}</option>)}</select></label>
                <label>Jenis<select value={form.jenis} onChange={e=>setForm({...form,jenis:e.target.value})}><option>Jaksa</option><option>TU</option></select></label>
                <label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Aktif</option><option>Naik Pangkat</option><option>Mutasi</option><option>Pensiun</option></select></label>
                <label>
                  Tanggal Lahir
                  <input
                    type="date"
                    value={form.tanggal_lahir || ''}
                    onChange={e=>setForm({...form,tanggal_lahir:e.target.value})}
                  />
                </label>
                <label>TMT Pangkat<input type="date" value={form.tmt_pangkat||''} onChange={e=>setForm({...form,tmt_pangkat:e.target.value})}/></label>
                <label>TMT Jabatan<input type="date" value={form.tmt_jabatan||''} onChange={e=>setForm({...form,tmt_jabatan:e.target.value})}/></label>
                <label>Tanggal Pensiun<input type="date" value={form.tanggal_pensiun||''} onChange={e=>setForm({...form,tanggal_pensiun:e.target.value})}/></label>
                <label className="fullRow">Keterangan<textarea value={form.keterangan||''} onChange={e=>setForm({...form,keterangan:e.target.value})}/></label>
              </div>
              <div className="modalActions">
                <button type="button" className="btn outline" onClick={()=>setModal(false)}>Batal</button>
                <button className="btn primary"><Save size={16}/>Simpan</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}

function Kpi({icon,label,value}){return <article className="kpi"><div className="kpiIcon">{icon}</div><span>{label}</span><strong>{value}</strong><small>Database pusat</small></article>}
function Title({title,sub}){return <div className="panelTitle"><h3>{title}</h3><p>{sub}</p></div>}
function History({items,onUndo}){
  if(!items.length)return <p className="note">Belum ada riwayat perubahan.</p>;
  return <div className="historyList">
    {items.map(h=>(
      <div className="historyItem" key={h.id}>
        <div className="historyIcon">↻</div>
        <div>
          <strong>{h.tipe}</strong>
          <small>
            {h.pegawai_nama ? `${h.pegawai_nama} · ` : ''}
            {new Date(h.created_at).toLocaleString('id-ID')} · {h.admin_nama||'-'}
          </small>
          <p>
            {h.field_diubah ? `${h.field_diubah}: ` : ''}
            {h.nilai_lama||'-'} → {h.nilai_baru||'-'}
            {h.catatan?` · Catatan: ${h.catatan}`:''}
          </p>
         {h.tipe !== 'UNDO' && onUndo && (
  <button
    className="btn outline"
    onClick={() => onUndo(h)}
    style={{marginTop:'8px'}}
  >
    Undo
  </button>
)}
        </div>
      </div>
    ))}
  </div>
}

createRoot(document.getElementById('root')).render(<App/>)
// sort pegawai by urutan pangkat
// add load users function
// add users page
// tambah menu manajemen user
// fix menu error
// tambah menu manajemen user
// add user management page
// tambah halaman Manajemen User
// Fix users title
// load users data
// Fix user management section layout
// SIGAP-BU v3.1 Stable

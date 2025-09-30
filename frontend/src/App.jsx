import { useEffect, useMemo, useState } from 'react'
import './App.css'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet'
import L from 'leaflet'
import { fetchHealth, getDashboardSummary, getInsights, getRecommendations, getMapLayers, login, logout, api, dssScore, dssScoreBatch, dssMlScore, dssMlScoreBatch, getDashboardAggregates, getLandUseInsights, listClaims } from './lib/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'

const TABS = [
  { key: 'home', label: 'Home' },
  { key: 'map', label: 'WebGIS Map' },
  { key: 'dss', label: 'Decision Support' },
  { key: 'ai', label: 'AI Insights' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'about', label: 'About' },
]

function Navbar({ active, onSelect }) {
  return (
    <div className="navbar">
      <div className="brand">FRA Claims Regulation</div>
      <div className="tabs">
        {TABS.map(t => (
          <div key={t.key} className={`tab ${active === t.key ? 'active' : ''}`} onClick={() => onSelect(t.key)}>
            {t.label}
          </div>
        ))}
      </div>
    </div>
  )
}

function WebGISMap() {
  const center = useMemo(() => [20.5937, 78.9629], [])
  const [layers, setLayers] = useState([])
  const [error, setError] = useState(null)
  const [geojsonData, setGeojsonData] = useState({})
  const [visible, setVisible] = useState({})
  const [opacity, setOpacity] = useState({})
  const [basemap, setBasemap] = useState('osm')
  const [map, setMap] = useState(null)
  const [search, setSearch] = useState('')
  const [filterState, setFilterState] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  useEffect(() => {
    getMapLayers().then(async (lyrs) => {
      setLayers(lyrs)
      const loaded = {}
      const vis = {}
      const op = {}
      for (const l of lyrs) {
        try {
          const path = l.url && l.url.startsWith('/api/') ? l.url.slice(4) : l.url
          const { data } = await api.get(path)
          loaded[l.id] = data
          vis[l.id] = true
          op[l.id] = l.id === 'india' ? 0.4 : 0.8
        } catch (e) {}
      }
      setGeojsonData(loaded)
      setVisible(vis)
      setOpacity(op)
    }).catch(e => setError(String(e)))
  }, [])

  function layerStyle(id, feature) {
    if (id === 'india') return { color: '#60a5fa', weight: 2, fillOpacity: 0.05 }
    if (id === 'fra_claims') {
      const status = feature?.properties?.status || 'pending'
      const color = status === 'approved' ? '#22c55e' : status === 'rejected' ? '#ef4444' : '#eab308'
      return { color, weight: 1, fillOpacity: opacity[id] ?? 0.8 }
    }
    return { color: '#22c55e', weight: 1, fillOpacity: opacity[id] ?? 0.2, opacity: opacity[id] ?? 0.8 }
  }

  function onEachFeature(feature, layer) {
    const props = feature?.properties || {}
    const lines = Object.entries(props).map(([k, v]) => `<div><strong>${k}</strong>: ${v}</div>`).join('')
    if (lines) layer.bindPopup(`<div>${lines}</div>`)
  }

  return (
    <div className="content">
      <div className="map-container">
        <MapContainer center={center} zoom={5} style={{ height: '100%', width: '100%' }} whenCreated={setMap}>
          {basemap === 'osm' && (
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          )}
          {basemap === 'carto' && (
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap contributors & CARTO" />
          )}
          {basemap === 'sat' && (
            <TileLayer url="https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" subdomains={["0","1","2","3"]} attribution="Imagery © Google" />
          )}
          {Object.entries(geojsonData).map(([id, gj]) => (
            visible[id] ? (
              <GeoJSON
                key={id}
                data={id === 'fra_claims' ? {
                  ...gj,
                  features: (gj.features || []).filter(f => {
                    const stateOk = filterState === 'all' ? true : (f.properties?.state === filterState)
                    const statusOk = filterStatus === 'all' ? true : (f.properties?.status === filterStatus)
                    return stateOk && statusOk
                  })
                } : gj}
                style={(feat) => layerStyle(id, feat)}
                pointToLayer={(feat, latlng) => {
                  if (id === 'fra_claims') {
                    const style = layerStyle(id, feat)
                    return L.circleMarker(latlng, { radius: 6, color: style.color, weight: 1, fillOpacity: 0.9 })
                  }
                  return L.marker(latlng)
                }}
                onEachFeature={onEachFeature}
              />
            ) : null
          ))}
          <Marker position={[19.076, 72.8777]}>
            <Popup>Sample marker (Mumbai)</Popup>
          </Marker>
        </MapContainer>
        <div className="map-controls">
          <h4>Layers</h4>
          {layers.map(l => (
            <div key={l.id} className="row">
              <input id={`layer-${l.id}`} type="checkbox" checked={!!visible[l.id]} onChange={(e)=>setVisible(v=>({...v,[l.id]: e.target.checked}))} />
              <label htmlFor={`layer-${l.id}`}>{l.name}</label>
              <input type="range" min="0" max="1" step="0.05" value={opacity[l.id] ?? 0.8} onChange={(e)=>setOpacity(o=>({...o,[l.id]: Number(e.target.value)}))} style={{marginLeft:8}} />
            </div>
          ))}
          <h4>Basemap</h4>
          <div className="row">
            <select value={basemap} onChange={(e)=>setBasemap(e.target.value)}>
              <option value="osm">OpenStreetMap</option>
              <option value="carto">Carto Light</option>
              <option value="sat">Satellite</option>
            </select>
          </div>
          <h4>Search</h4>
          <div className="row">
            <input placeholder="Search place" value={search} onChange={(e)=>setSearch(e.target.value)} />
            <button onClick={async ()=>{
              if (!search) return
              try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}`)
                const [first] = await res.json()
                if (first && map) {
                  map.flyTo([parseFloat(first.lat), parseFloat(first.lon)], 10)
                }
              } catch {}
            }}>Go</button>
          </div>
          <h4>Filters</h4>
          <div className="row">
            <label>State</label>
            <select value={filterState} onChange={(e)=>setFilterState(e.target.value)}>
              <option value="all">All</option>
              <option value="MH">Maharashtra</option>
              <option value="MP">Madhya Pradesh</option>
              <option value="OD">Odisha</option>
              <option value="TR">Tripura</option>
            </select>
          </div>
          <div className="row">
            <label>Status</label>
            <select value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="row">
            <button onClick={() => {
              const gj = geojsonData['fra_claims']
              if (!gj) return
              const filtered = {
                type: 'FeatureCollection',
                features: (gj.features || []).filter(f => {
                  const stateOk = filterState === 'all' ? true : (f.properties?.state === filterState)
                  const statusOk = filterStatus === 'all' ? true : (f.properties?.status === filterStatus)
                  return stateOk && statusOk
                })
              }
              const content = JSON.stringify(filtered)
              const blob = new Blob([content], { type: 'application/geo+json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'fra_claims_filtered.geojson'
              a.click()
              URL.revokeObjectURL(url)
            }}>Export GeoJSON</button>
            <button onClick={() => {
              const gj = geojsonData['fra_claims']
              if (!gj) return
              const rows = [['claim_id','claimant','state','status','lon','lat']]
              for (const f of (gj.features || [])) {
                const stateOk = filterState === 'all' ? true : (f.properties?.state === filterState)
                const statusOk = filterStatus === 'all' ? true : (f.properties?.status === filterStatus)
                if (!(stateOk && statusOk)) continue
                const [lon, lat] = (f.geometry?.coordinates || [null, null])
                rows.push([
                  f.properties?.claim_id ?? '',
                  f.properties?.claimant ?? '',
                  f.properties?.state ?? '',
                  f.properties?.status ?? '',
                  lon ?? '',
                  lat ?? ''
                ])
              }
              const csv = rows.map(r => r.map(v => `${String(v).replaceAll('"','""')}`).join(',')).join('\n')
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'fra_claims_filtered.csv'
              a.click()
              URL.revokeObjectURL(url)
            }}>Export CSV</button>
          </div>
        </div>
        <div className="legend">
          <div className="item"><span className="swatch" style={{background:'#60a5fa'}}></span> India Outline</div>
          <div className="item"><span className="swatch" style={{background:'#22c55e'}}></span> States</div>
          <div className="item"><span className="swatch" style={{background:'#22c55e'}}></span> Approved</div>
          <div className="item"><span className="swatch" style={{background:'#eab308'}}></span> Pending</div>
          <div className="item"><span className="swatch" style={{background:'#ef4444'}}></span> Rejected</div>
        </div>
      </div>
      {error && <p style={{color:'#f87171'}}>Error loading layers: {error}</p>}
      {!!layers.length && <p>Loaded layers: {layers.map(l => l.name).join(', ')}</p>}
    </div>
  )
}

function Home() {
  return (
    <div className="content">
      <div className="hero">
        <h1>FRA Claims Regulation Portal</h1>
        <p>
          Streamline processing and oversight of Forest Rights Act (FRA) claims across states
          including Maharashtra, Madhya Pradesh, Odisha, and Tripura. Explore claims, view
          geospatial layers, and use decision support and AI insights for faster, transparent
          resolution.
        </p>
        <div className="hero-cards">
          <div className="cardish"><h3>WebGIS</h3><p>Interactive maps with state outlines and FRA claim layers.</p></div>
          <div className="cardish"><h3>Decision Support</h3><p>Recommendations to prioritize and validate claims.</p></div>
          <div className="cardish"><h3>AI Insights</h3><p>Key metrics: processing time, duplicates, completeness.</p></div>
          <div className="cardish"><h3>Dashboard</h3><p>Aggregated counts by status and state.</p></div>
        </div>
        <div className="hero-note">
          <strong>About FRA:</strong> The Forest Rights Act, 2006 recognizes the rights of forest-dwelling
          communities over land and resources. This portal supports verification and monitoring of claims
          with geospatial context and data-driven insights.
        </div>
      </div>
    </div>
  )
}

function DecisionSupport() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [single, setSingle] = useState({ claim_id: 'CLM-2001', docs_complete: true, is_duplicate: false, area_ha: 1.8, is_in_critical_wildlife_zone: false, community_support: true, status: 'pending' })
  const [batch, setBatch] = useState([])
  const [mode, setMode] = useState('rules') // 'rules' | 'ml'

  useEffect(() => {
    setLoading(true)
    getRecommendations({ state: 'MH' })
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="content">
      <h2>Decision Support System</h2>
      {loading && <p>Loading recommendations…</p>}
      {error && <p style={{color:'#f87171'}}>Error: {error}</p>}
      {data && (
        <ul>
          {data.recommendations.map(r => (
            <li key={r.id}>{r.title} ({r.impact})</li>
          ))}
        </ul>
      )}
      <div style={{marginTop:16}}>
        <h3>AI Prioritization (Single Claim)</h3>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:8}}>
          <input placeholder="Claim ID" value={single.claim_id} onChange={e=>setSingle(s=>({...s, claim_id:e.target.value}))} />
          <input placeholder="Area (ha)" type="number" value={single.area_ha} onChange={e=>setSingle(s=>({...s, area_ha:Number(e.target.value)}))} />
          <select value={single.status} onChange={e=>setSingle(s=>({...s, status:e.target.value}))}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <label><input type="checkbox" checked={single.docs_complete} onChange={e=>setSingle(s=>({...s, docs_complete:e.target.checked}))} /> Docs complete</label>
          <label><input type="checkbox" checked={single.is_duplicate} onChange={e=>setSingle(s=>({...s, is_duplicate:e.target.checked}))} /> Possible duplicate</label>
          <label><input type="checkbox" checked={single.is_in_critical_wildlife_zone} onChange={e=>setSingle(s=>({...s, is_in_critical_wildlife_zone:e.target.checked}))} /> Critical wildlife zone</label>
          <label><input type="checkbox" checked={single.community_support} onChange={e=>setSingle(s=>({...s, community_support:e.target.checked}))} /> Community support</label>
        </div>
        <div style={{marginTop:8, display:'flex', gap:8, alignItems:'center'}}>
          <label>Mode</label>
          <select value={mode} onChange={(e)=>setMode(e.target.value)}>
            <option value="rules">Rule-based</option>
            <option value="ml">ML Model</option>
          </select>
          <button onClick={async ()=>{
            try {
              if (mode === 'rules') {
                const res = await dssScore(single)
                alert(`Score: ${res.result.score} (${res.result.priority})\n${res.result.explanation}`)
              } else {
                const res = await dssMlScore(single)
                alert(`Score: ${res.result.score} (${res.result.priority})\nProb: ${res.result.prob.toFixed(3)}`)
              }
            } catch(e) { alert(String(e)) }
          }}>Score Claim</button>
        </div>
      </div>

      <div style={{marginTop:24}}>
        <h3>AI Prioritization (Batch)</h3>
        <p>Load sample FRA claims from the map layer and score them.</p>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <button onClick={async()=>{
            try {
              const claims = await listClaims()
              setBatch(claims.slice(0, 20))
            } catch(e){ alert(String(e)) }
          }}>Load sample batch</button>
          <button onClick={async ()=>{
            try {
              const results = mode === 'rules' ? (await dssScoreBatch(batch)).results : (await dssMlScoreBatch(batch)).results
              const sorted = [...results].sort((a,b)=> b.result.score - a.result.score)
              setBatch(sorted.map(r => ({ ...r.input, score: r.result.score, priority: r.result.priority, explanation: r.result.explanation, prob: r.result.prob })))
            } catch(e){ alert(String(e)) }
          }} disabled={!batch.length}>Score batch</button>
        </div>
        {!!batch.length && (
          <div style={{overflowX:'auto', marginTop:8}}>
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  <th>Claim ID</th>
                  <th>Claimant</th>
                  <th>State</th>
                  <th>Status</th>
                  <th>Area (ha)</th>
                  <th>Score</th>
                  <th>Priority</th>
                  <th>Explanation / Prob</th>
                </tr>
              </thead>
              <tbody>
                {batch.map(row => (
                  <tr key={row.claim_id}>
                    <td>{row.claim_id}</td>
                    <td>{row.claimant}</td>
                    <td>{row.state}</td>
                    <td>{row.status}</td>
                    <td>{row.area_ha ?? ''}</td>
                    <td>{row.score ?? ''}</td>
                    <td>{row.priority ?? ''}</td>
                    <td style={{whiteSpace:'pre-wrap'}}>{mode==='ml' ? (row.prob!=null ? `prob=${Number(row.prob).toFixed(3)}` : '') : (row.explanation ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function AIInsights() {
  const [insights, setInsights] = useState([])
  const [landUse, setLandUse] = useState([])
  const [error, setError] = useState(null)
  useEffect(() => {
    getInsights().then(setInsights).catch(e => setError(String(e)))
    getLandUseInsights().then(setLandUse).catch(e => setError(String(e)))
  }, [])
  return (
    <div className="content">
      <h2>AI Insights</h2>
      {error && <p style={{color:'#f87171'}}>Error: {error}</p>}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16}}>
        <div>
          <h3>Key Metrics</h3>
          <ul>
            {insights.map(i => (
              <li key={i.metric}>{i.metric}: {i.value}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Land-use Suggestions</h3>
          <ul>
            {landUse.map(lu => (
              <li key={lu.land_type}><strong>{lu.land_type}</strong>: {lu.suggestion} (avg area: {lu.avg_area_ha} ha, claims: {lu.claims})</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [aggs, setAggs] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    getDashboardSummary().then(setSummary).catch(e => setError(String(e)))
    getDashboardAggregates().then(setAggs).catch(e => setError(String(e)))
  }, [])
  return (
    <div className="content">
      <h2>Dashboard</h2>
      {error && <p style={{color:'#f87171'}}>Error: {error}</p>}
      {summary && (
        <div style={{marginBottom:12}}>
          <p>Total claims: {summary.total_claims}, Approved: {summary.approved}, Pending: {summary.pending}, Rejected: {summary.rejected}</p>
        </div>
      )}
      {aggs && (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:16}}>
          <div style={{height:260, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:8}}>
            <h3>Status by State</h3>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={Object.entries(aggs.by_state).map(([k,v])=>({state:k,count:v}))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e3a5a" />
                <XAxis dataKey="state" stroke="#aab4c3" />
                <YAxis stroke="#aab4c3" />
                <Tooltip />
                <Bar dataKey="count" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{height:260, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:8}}>
            <h3>Monthly Intake</h3>
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={Object.entries(aggs.by_month).map(([k,v])=>({month:k,count:v}))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e3a5a" />
                <XAxis dataKey="month" stroke="#aab4c3" />
                <YAxis stroke="#aab4c3" />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{height:260, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:8}}>
            <h3>Area Distribution</h3>
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie data={Object.entries(aggs.area_buckets).map(([k,v])=>({bucket:k,count:v}))} dataKey="count" nameKey="bucket" outerRadius={80}>
                  {['#60a5fa','#22c55e','#eab308','#ef4444'].map((c,i)=>(<Cell key={i} fill={c} />))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

function About() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => { fetchHealth().then(setHealth).catch(e => setError(String(e))) }, [])
  return (
    <div className="content">
      <h2>About</h2>
      <p>SIH 12508: FRA Claims Regulation. Tech: Flask, React, Leaflet.</p>
      {error && <p style={{color:'#f87171'}}>Error: {error}</p>}
      {health && <p>Backend status: {health.status} (env: {health.env})</p>}
    </div>
  )
}

function App() {
  const [tab, setTab] = useState('home')
  const [user, setUser] = useState(null)
  const [creds, setCreds] = useState({ identifier: 'admin@example.com', password: 'admin123' })
  const [authErr, setAuthErr] = useState(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

  const isAuthed = !!token
  return (
    <>
      <Navbar active={tab} onSelect={setTab} />
      {isAuthed && (
        <div className="content" style={{paddingTop:0}}>
          <button onClick={()=>{ logout(); window.location.reload() }}>Logout</button>
        </div>
      )}
      {tab === 'home' && <Home />}
      {!isAuthed && tab !== 'home' && (
        <div className="content">
          <h3>Login</h3>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <input placeholder="email or phone" value={creds.identifier} onChange={e=>setCreds({...creds, identifier:e.target.value})} />
            <input placeholder="password" type="password" value={creds.password} onChange={e=>setCreds({...creds, password:e.target.value})} />
            <button onClick={async ()=>{ try { const data = await login(creds.identifier, creds.password); setUser(data.user); setAuthErr(null); setTab('map'); } catch(e){ setAuthErr(String(e)); } }}>Login</button>
          </div>
          {authErr && <p style={{color:'#f87171'}}>Auth error: {authErr}</p>}
          <p>Demo users: admin@example.com / +911234567890 (password: admin123), officer@example.com / +919876543210 (password: officer123).</p>
        </div>
      )}
      {isAuthed && tab === 'map' && <WebGISMap />}
      {isAuthed && tab === 'dss' && <DecisionSupport />}
      {isAuthed && tab === 'ai' && <AIInsights />}
      {isAuthed && tab === 'dashboard' && <Dashboard />}
      {tab === 'about' && <About />}
    </>
  )
}

export default App

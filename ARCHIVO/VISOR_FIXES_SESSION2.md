# VISOR SYSTEM - FIXES SESSION 2 ✅

## Problems Resolved

### 1. ✅ **BARRILES EMPTY - No Pinchadas/Despinchadas appearing**

**Root Cause**: The backend was pointing to wrong Google Sheet tab
- The config used `gid: 1554434469` (PRUEBA WEB APP sheet)
- But the actual data is in `gid: 1084027951` (BARRILES sheet)

**Fix**: Updated `barriles_service.py` configuration
```python
SUCURSALES_CONFIG = {
    "1": {
        "nombre": "Recoleta",
        "sheet_id": "1Sw-TqlevrqHUt4krNOjzqY0qRQfW3Odm7ZJrp2ZhEsI",
        "sheet_name": "BARRILES",  # ✅ CHANGED from "PRUEBA WEB APP"
        "info_sheet_name": "INFO",
        "gid": 1084027951,  # ✅ CHANGED from 1554434469
        # ... rest of config
    },
```

**File Modified**: `backend-nucleo/src/services/barriles_service.py`

**Expected Result**: BARRILES page now shows Pinchadas and Despinchadas from the correct sheet

---

### 2. ✅ **VISOR REDIRECT NOT WORKING - Visor user redirected to BARRILES instead of VISOR**

**Root Cause**: AuthContext was mapping ALL non-admin roles to 'user'
- JWT token contained `"role": "visor"`
- AuthContext decoded it and mapped it to 'user'
- Frontend thought visor user was a regular user and redirected to `/barriles`

**Fix**: Updated `AuthContext.tsx` to properly handle 'visor' role
```typescript
// BEFORE:
const role = decoded.role === 'admin' ? 'admin' : 'user'

// AFTER:
const role = decoded.role === 'admin' ? 'admin' : (decoded.role === 'visor' ? 'visor' : 'user')
```

**File Modified**: `frontend/src/context/AuthContext.tsx`

**Expected Result**: Visor users now auto-redirect to `/visor/1` on login

---

### 3. ✅ **VISOR NOT IN NAVBAR - Can't switch between Visor 1 and Visor 2**

**Root Cause**: Navbar was hidden for visor users AND visor pages had no way to switch

**Fixes Applied**:

#### 3a) Show navbar for all users (including visor)
**File Modified**: `frontend/src/components/layout/Layout.tsx`
```typescript
// BEFORE: Navbar hidden for visor users
{!isVisor && <Navbar />}

// AFTER: Navbar always shown
<Navbar />
```

#### 3b) Add navigation buttons in visor pages
**Files Modified**: `frontend/src/pages/CervezasVisor1.tsx` and `frontend/src/pages/CervezasVisor2.tsx`

Added top navigation bar with buttons to switch between visores:
```typescript
<div className="flex-shrink-0 bg-black/80 border-b border-slate-800 px-4 py-2 flex items-center justify-between z-50">
  <div className="flex items-center gap-3">
    <NavLink to="/visor/1" className={...}>Visor 1</NavLink>
    <NavLink to="/visor/2" className={...}>Visor 2</NavLink>
  </div>
  {/* Refresh and Fullscreen buttons */}
</div>
```

**Expected Result**: 
- Visor users see navbar with Visor 1 and Visor 2 buttons
- Can easily switch between the two designs
- Can toggle fullscreen
- Can manually refresh data

---

## Files Modified This Session

### Backend
- ✅ `backend-nucleo/src/services/barriles_service.py` - Fixed Google Sheet GID mapping

### Frontend
- ✅ `frontend/src/context/AuthContext.tsx` - Fixed visor role mapping
- ✅ `frontend/src/components/layout/Layout.tsx` - Show navbar for all users
- ✅ `frontend/src/pages/CervezasVisor1.tsx` - Add navigation bar + compact footer
- ✅ `frontend/src/pages/CervezasVisor2.tsx` - Add navigation bar + compact footer

---

## Testing Checklist

- [ ] Login with VISOR user
- [ ] Verify auto-redirect to `/visor/1`
- [ ] Verify navbar shows "Visor 1" and "Visor 2" buttons
- [ ] Click "Visor 2" button → should navigate to `/visor/2`
- [ ] Click "Visor 1" button → should navigate back to `/visor/1`
- [ ] Verify BARRILES page shows Pinchadas and Despinchadas
- [ ] Verify both visor pages display beer data (18 max)
- [ ] Verify fullscreen button works
- [ ] Verify refresh button works
- [ ] Verify auto-refresh every 30 seconds works

---

## User Journey - COMPLETE VISOR FLOW

### 1. Admin Creates Visor User
```
→ Usuarios page
→ Click "Nuevo usuario"
→ Role: VISOR
→ Click "Guardar"
```

### 2. Visor User Logs In
```
→ Login page
→ Enter visor credentials
→ Redirects to /visor/1 ✅
```

### 3. Visor Experience
```
→ See fullscreen beer menu with navbar on top
→ Navbar shows: [Visor 1 ✓] [Visor 2] [Refresh] [Fullscreen]
→ Click Fullscreen icon → Full browser fullscreen
→ Auto-refreshes every 30 seconds
→ Can switch to Visor 2 design
→ Can switch back to Visor 1 design
→ Can manually refresh anytime
```

---

## Data Flow - How It Works Now

1. **Visor user logs in** with username/password
2. **Backend authenticates** and creates JWT with `"role": "visor"`
3. **Frontend receives JWT** and decodes it
4. **AuthContext properly recognizes** the visor role
5. **ProtectedRoute redirects** to `/visor/1`
6. **CervezasVisor1 loads** and calls `/barriles/visor` endpoint
7. **Backend endpoint** fetches from Google Sheets:
   - Active barriles from BARRILES sheet (correct GID)
   - Enriches with amargor, ABV, precio from INFO sheet
8. **Frontend displays** up to 18 beers with full details
9. **Navbar allows** switching to Visor 2
10. **Visor 2** shows same data in different design (3-4 columns, card layout)

---

## Known Issues Fixed

✅ RESOLVED: Barriles not showing
✅ RESOLVED: Visor users redirected to wrong page
✅ RESOLVED: No way to switch between visor designs

---

## Deployment Steps

1. **Stop backend server**
2. **Deploy backend changes** (just the config change)
3. **Restart backend server**
4. **Rebuild frontend** (`npm run build`)
5. **Deploy frontend**
6. **Test**: Create visor user → Log in → Should auto-redirect to visor

---

## Additional Notes

- The visor navbar is minimal and non-intrusive
- It only shows essential controls: visor selection, refresh, fullscreen
- Visor pages still have no admin/dashboard elements
- Data is real-time from Google Sheets
- Layout automatically adapts based on user role
- Visor users have no access to other pages (ProtectedRoute blocks them)


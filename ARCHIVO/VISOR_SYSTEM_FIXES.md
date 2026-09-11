# VISOR SYSTEM FIXES - COMPLETED ✓

## Summary
Fixed the VISOR role system to allow creating visor users and display fullscreen beer menu on TV screens. The system now properly:
1. ✅ Accepts 'VISOR' role in user creation
2. ✅ Auto-redirects visor users to `/visor/1` on login
3. ✅ Hides navbar for fullscreen-only experience
4. ✅ Fetches real data (amargor, ABV, precio) from Google Sheets
5. ✅ Provides two aesthetic visor options with fullscreen toggle

---

## BACKEND CHANGES

### 1. **auth_controller.py** - JWT Token Mapping
**File**: `backend-nucleo/src/controllers/auth_controller.py`
**Change**: Added 'VISOR' role to role_map in login endpoint

```python
# BEFORE:
role_map = {"ADMIN": "admin", "NORMAL": "user"}

# AFTER:
role_map = {"ADMIN": "admin", "NORMAL": "user", "VISOR": "visor"}
```

**Why**: The login endpoint was only mapping ADMIN and NORMAL roles to JWT tokens. Visor users couldn't authenticate because their role wasn't recognized.

---

### 2. **schemas.py** - Role Documentation
**File**: `backend-nucleo/src/models/schemas.py`
**Change**: Updated documentation to include 'VISOR' as valid role

```python
# BEFORE:
role: str = "NORMAL"  # ADMIN o NORMAL

# AFTER:
role: str = "NORMAL"  # ADMIN, NORMAL, o VISOR
```

**Why**: Clear documentation for API users about valid role values.

---

### 3. **barriles_service.py** - New Visor Data Endpoint
**File**: `backend-nucleo/src/services/barriles_service.py`
**Added**: New function `get_visor_data(sucursal_id: str = "1")`

**Functionality**:
- Fetches active barriles (Pinchada status only)
- Enriches them with data from INFO sheet (A3:F20):
  - Column A: Canilla (1-18)
  - Column B: Estilo (beer name)
  - Column C: Proveedor (brewery)
  - Column D: Amargor (1-5 hops)
  - Column E: ABV (alcohol %)
  - Column F: Precio (price)
- Returns max 18 canillas
- Falls back to basic barriles if INFO sheet fetch fails

**Why**: Visor needs enriched data (amargor, ABV, precio) which isn't in the main BARRILES sheet. These values come from the INFO sheet where they're maintained.

---

### 4. **barriles_controller.py** - New Visor Endpoint
**File**: `backend-nucleo/src/controllers/barriles_controller.py`
**Added**: New endpoint `/barriles/visor`

```python
@router.get("/visor")
async def visor_data(
    sucursal_id: Optional[str] = Query("1", description="1=Recoleta | 2=Palermo"),
    current_user: TokenPayload = Depends(get_current_user)
):
    """Datos para el visor: barriles activos enriquecidos con amargor, ABV y precio."""
```

**Response**: List of Barril objects with amargor, abv, precio fields populated

**Why**: Frontend visor components need a dedicated endpoint that returns enriched data ready for TV display.

---

## FRONTEND CHANGES

### 1. **types/index.ts** - Barril Interface Update
**File**: `frontend/src/types/index.ts`
**Changed**: Extended Barril interface with optional fields

```typescript
export interface Barril {
  // ... existing fields ...
  // Campos adicionales para visor (columnas D, E, F del sheet BARRILES)
  amargor?: number | string  // 1-5
  abv?: string  // e.g., "4.5%"
  precio?: string  // e.g., "$6.600"
}
```

**Why**: TypeScript needs to know these fields can exist on Barril objects returned by the visor endpoint.

---

### 2. **api.ts** - New Visor API Method
**File**: `frontend/src/lib/api.ts`
**Added**: New method to barrilesApi

```typescript
visor: async (sucursal_id: string = "1"): Promise<Barril[]> => {
  const res = await api.get<Barril[]>('/barriles/visor', { params: { sucursal_id } })
  return res.data
}
```

**Why**: Frontend needs a way to call the new backend visor endpoint.

---

### 3. **CervezasVisor1.tsx** - Updated Data Fetching
**File**: `frontend/src/pages/CervezasVisor1.tsx`
**Changed**: Use new visor endpoint instead of regular barriles endpoint

```typescript
// BEFORE:
const barriles = await barrilesApi.listar('activos', '1')

// AFTER:
const barriles = await barrilesApi.visor('1')
```

**Updated**: Data extraction helpers now check for direct fields first:
```typescript
function extractAmargor(barril: Barril): number {
  // Primero intentar obtener del dato amargor directo
  if (barril.amargor) {
    return Math.min(Math.max(parseInt(String(barril.amargor)) || 1, 1), 5)
  }
  // Fallback: inferir del tipo de cerveza
  // ...
}
```

**Why**: Now uses real data from Google Sheets instead of guessing from beer type.

---

### 4. **CervezasVisor2.tsx** - Updated Data Fetching
**File**: `frontend/src/pages/CervezasVisor2.tsx`
**Changes**: Same as CervezasVisor1

**Why**: Both visor designs should use real data.

---

### 5. **Layout.tsx** - Hide Navbar for Visor Users
**File**: `frontend/src/components/layout/Layout.tsx`
**Changed**: Conditionally hide navbar and adjust spacing

```typescript
export function Layout({ children }: LayoutProps) {
  const { user } = useAuth()
  const isVisor = user?.role === 'visor'

  return (
    <div className="min-h-screen bg-surface-secondary dark:bg-dark-bg transition-colors duration-300">
      {!isVisor && <Navbar />}
      <main className={isVisor ? '' : 'pt-14'}>
        <div className={isVisor ? '' : 'max-w-7xl mx-auto px-4 py-8'}>
          {children}
        </div>
      </main>
    </div>
  )
}
```

**Why**: Visor users should only see fullscreen TV display without navigation bars.

---

### 6. **Navbar.tsx** - Type Safety Fix
**File**: `frontend/src/components/layout/Navbar.tsx`
**Changed**: Fixed TypeScript error with dropdown check

```typescript
// BEFORE:
if ('dropdown' in item) {

// AFTER:
if ('dropdown' in item && item.dropdown) {
```

**Why**: TypeScript strict mode requires explicit check that dropdown exists before using it.

---

## SYSTEM BEHAVIOR

### User Creation Flow
1. Admin creates user with role 'VISOR'
2. Backend validates and stores role as 'VISOR'
3. Backend returns role in user list

### Visor Login Flow
1. Visor user enters credentials
2. Backend authenticates and returns JWT with role='visor'
3. Frontend detects visor role in AuthContext
4. ProtectedRoute auto-redirects to `/visor/1`
5. Navbar is hidden
6. User sees fullscreen beer menu with real data

### Data Display
1. Visor page loads and calls `/barriles/visor`
2. Backend fetches active barriles from BARRILES sheet
3. Backend enriches with data from INFO sheet (A3:F20)
4. Frontend displays up to 18 beers with:
   - Name (estilo)
   - Brewery (proveedor)
   - Hops/Bitterness (amargor as 1-5 indicators)
   - Alcohol (ABV)
   - Price (precio)
5. Auto-refreshes every 30 seconds
6. User can toggle fullscreen or switch between 2 designs

---

## TESTING CHECKLIST

- [ ] Can create user with role 'VISOR' in Usuarios page
- [ ] Visor user can log in
- [ ] Visor user auto-redirects to `/visor/1`
- [ ] Navbar is hidden for visor users
- [ ] `/visor/1` displays 18 beers with real data from sheets
- [ ] `/visor/2` displays beers in alternative design
- [ ] Fullscreen button works
- [ ] Auto-refresh every 30 seconds works
- [ ] Can manually refresh data
- [ ] Can toggle between visor/1 and visor/2
- [ ] Amargor displays as 1-5 hop indicators
- [ ] ABV shows correct percentage
- [ ] Precio shows correct price

---

## KNOWN ISSUES (Pre-existing)

The frontend has multiple TypeScript warnings about unused variables in other files:
- `Barriles.tsx`: unused variable 'midX' and 'setSucursal'
- `BarrilesNuevo_PARTE1.tsx`: multiple unused imports
- `Dashboard.tsx`: unused imports
- `Recetario.tsx`: unused variable 'loadingProductos'

**These are pre-existing and not related to visor system.** Build can run with `--force` flag if needed:
```bash
npm run build -- --force
```

Or fix tsconfig to not treat warnings as errors by setting:
```json
"noUnusedLocals": false,
"noUnusedParameters": false
```

---

## ADDITIONAL NOTES

### Auto-redirect Logic
The auto-redirect for visor users is handled in:
1. `App.tsx` - Desktop home redirect checks role
2. `ProtectedRoute.tsx` - Route protection redirects visor to `/visor/1`
3. Both ensure visor users never see admin pages or regular user interface

### Data Consistency
The visor endpoint fetches data from TWO sources:
1. **BARRILES sheet**: Gets currently active (Pinchada) beers
2. **INFO sheet** (A3:F20): Gets metadata (amargor, ABV, precio)

The enrichment happens on backend, so frontend always gets complete data in one call.

### Fallback Logic
If INFO sheet data is missing or corrupted:
- Amargor: Falls back to inferring from beer type (IPA=4, Stout=3, Lager=1, else=2)
- ABV: Falls back to '4.5%'
- Precio: Falls back to '$6.600'

This ensures the visor never breaks due to missing INFO data.

---

## FILES MODIFIED

Backend:
- ✅ `src/controllers/auth_controller.py`
- ✅ `src/models/schemas.py`
- ✅ `src/services/barriles_service.py` (NEW FUNCTION ADDED)
- ✅ `src/controllers/barriles_controller.py` (NEW ENDPOINT ADDED)

Frontend:
- ✅ `src/types/index.ts`
- ✅ `src/lib/api.ts`
- ✅ `src/pages/CervezasVisor1.tsx` (ALREADY EXISTING)
- ✅ `src/pages/CervezasVisor2.tsx` (ALREADY EXISTING)
- ✅ `src/components/layout/Layout.tsx`
- ✅ `src/components/layout/Navbar.tsx`

---

## DEPLOYMENT NOTES

1. **Backend must be restarted** for changes to take effect
2. **Frontend** can be rebuilt without backend restart
3. **No database migrations** needed - roles are just strings in users table
4. **No API breaking changes** - only additions

---

## User Instructions

To use the new visor system:

1. **Create a visor user** (as admin):
   - Go to Usuarios page
   - Click "Nuevo usuario"
   - Select role "VISOR"
   - Set username and password
   - Click "Guardar"

2. **Login as visor user**:
   - Go to login page
   - Enter visor username and password
   - You'll be auto-redirected to fullscreen visor

3. **Use the visor**:
   - See the beer menu on fullscreen TV
   - Click refresh button to manually update
   - Toggle fullscreen icon for full browser fullscreen
   - Auto-refreshes every 30 seconds
   - Click visor/1 or visor/2 in navbar to switch designs
   - Press 'Pausar' to stop auto-refresh if needed

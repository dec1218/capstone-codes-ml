import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateStaffBody {
  email?: string
  password?: string
  fullName?: string
  username?: string
  contactNumber?: string
  status?: 'Active' | 'Inactive'
}

const respond = (body: Record<string, unknown>, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')

  if (!supabaseUrl || !serviceRoleKey) return respond({ error: 'Function configuration is incomplete.' }, 500)
  if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Authentication is required.' }, 401)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const token = authorization.slice('Bearer '.length)
  const { data: userData, error: userError } = await adminClient.auth.getUser(token)
  if (userError || !userData.user) return respond({ error: 'Your session is invalid or expired.' }, 401)

  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('full_name, role, status')
    .eq('id', userData.user.id)
    .single()

  if (profileError || callerProfile?.role !== 'admin' || callerProfile.status !== 'active') {
    return respond({ error: 'Only active administrators can create staff accounts.' }, 403)
  }

  let body: CreateStaffBody
  try {
    body = await request.json()
  } catch {
    return respond({ error: 'The request body must be valid JSON.' }, 400)
  }

  const email = body.email?.trim().toLowerCase() ?? ''
  const password = body.password ?? ''
  const fullName = body.fullName?.trim() ?? ''
  const username = body.username?.trim().toLowerCase() ?? ''
  const contactNumber = body.contactNumber?.replace(/\s/g, '') ?? ''
  const status = body.status === 'Inactive' ? 'inactive' : 'active'

  if (!/^\S+@\S+\.\S+$/.test(email)) return respond({ error: 'Enter a valid staff email address.' }, 400)
  if (password.length < 8) return respond({ error: 'The temporary password must contain at least 8 characters.' }, 400)
  if (fullName.length < 3) return respond({ error: 'Enter the staff member’s full name.' }, 400)
  if (!/^[a-z0-9._-]{4,}$/.test(username)) return respond({ error: 'Use at least 4 valid username characters.' }, 400)
  if (!/^09\d{9}$/.test(contactNumber)) return respond({ error: 'Enter a valid 11-digit Philippine mobile number.' }, 400)

  const { data: existingUsername } = await adminClient.from('profiles').select('id').ilike('username', username).maybeSingle()
  if (existingUsername) return respond({ error: 'This username is already assigned to another account.' }, 409)

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, username },
  })

  if (createError || !created.user) {
    const duplicate = createError?.message.toLowerCase().includes('already')
    return respond({ error: duplicate ? 'An account with this email already exists.' : createError?.message ?? 'Unable to create the Auth user.' }, duplicate ? 409 : 400)
  }

  const { error: updateError } = await adminClient.from('profiles').update({
    full_name: fullName,
    username,
    contact_number: contactNumber,
    role: 'staff',
    status,
  }).eq('id', created.user.id)

  if (updateError) {
    await adminClient.auth.admin.deleteUser(created.user.id)
    return respond({ error: 'The profile could not be created. The Auth user was rolled back.' }, 500)
  }

  await adminClient.from('activity_logs').insert({
    activity_type: 'Staff Activity',
    actor_id: userData.user.id,
    actor_name: callerProfile.full_name,
    action: 'Create',
    module: 'User Accounts',
    description: `Created staff account for ${fullName}.`,
    metadata: { staff_user_id: created.user.id },
  })

  return respond({ userId: created.user.id }, 201)
})

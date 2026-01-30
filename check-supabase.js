
import { createClient } from '@supabase/supabase-js'

const url = 'https://mbonmejtzzrkidutimuo.supabase.co'
const key = 'sb_publishable_EKGh8gnyfcBvdarzGjUCDQ_B2ERZqxI'

const supabase = createClient(url, key)

async function testConnection() {
    console.log('Testing Supabase connection...')
    try {
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true })
        if (error) {
            console.error('Connection failed:', error.message)
        } else {
            console.log('Connection successful! Profiles count:', data)
            // Try to list tables implicitly by just success of request
        }

        // Also try to list system_settings just to be sure
        const { data: settings, error: settingsError } = await supabase.from('system_settings').select('*').limit(1)
        if (settingsError) {
            console.error('Error fetching settings:', settingsError.message)
        } else {
            console.log('Fetched settings:', settings)
        }

    } catch (err) {
        console.error('Unexpected error:', err)
    }
}

testConnection()

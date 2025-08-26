#!/usr/bin/env tsx
/**
 * Simple Database Test
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log('URLs:', {
    url: SUPABASE_URL,
    keyLength: SUPABASE_SERVICE_KEY?.length || 0
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testConnection() {
    console.log('🧪 Testing database connection...');
    
    try {
        // Test basic query
        console.log('1. Testing vendors table...');
        const { data: vendors, error: vendorsError } = await supabase
            .from('vendors')
            .select('id, name')
            .limit(1);
            
        if (vendorsError) {
            console.error('❌ Vendors query failed:', vendorsError);
            return;
        }
        
        console.log('✅ Vendors:', vendors);
        
        // Test restaurants table
        console.log('2. Testing restaurants table...');
        const { data: restaurants, error: restaurantsError } = await supabase
            .from('restaurants')
            .select('*')
            .limit(5);
            
        if (restaurantsError) {
            console.error('❌ Restaurants query failed:', restaurantsError);
            return;
        }
        
        console.log('✅ Restaurants:', restaurants);
        
        // Test creating a restaurant
        console.log('3. Testing restaurant creation...');
        const { data: newRestaurant, error: createError } = await supabase
            .from('restaurants')
            .insert([{ 
                name: 'Los Pinos Test',
                description: 'Test restaurant for import',
                owner_id: null
            }])
            .select('*')
            .single();
            
        if (createError) {
            console.error('❌ Restaurant creation failed:', createError);
            return;
        }
        
        console.log('✅ Created/Updated restaurant:', newRestaurant);
        
        console.log('\n🎉 All tests passed!');
        
    } catch (error) {
        console.error('💥 Test failed:', error);
    } finally {
        process.exit(0);
    }
}

testConnection();
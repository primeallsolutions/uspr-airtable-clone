/**
 * Script to seed global predefined templates into the database
 * 
 * Usage:
 * 1. Make sure you have the Supabase service role key in .env.local
 * 2. Run: npx tsx lib/scripts/seed-templates.ts
 * 
 * This will create all predefined templates as global templates in the database.
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { PREDEFINED_TEMPLATES } from '../data/predefined-templates';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seedTemplates() {
  console.log('🌱 Starting template seeding...\n');

  for (const { template, category, icon } of PREDEFINED_TEMPLATES) {
    try {
      console.log(`📝 Creating template: ${template.base.name}`);
      
      // Check if template already exists
      const { data: existing, error: checkError } = await supabase
        .from('templates')
        .select('id, name')
        .eq('name', template.base.name)
        .eq('is_global', true)
        .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (existing) {
        console.log(`   ⚠️  Template "${template.base.name}" already exists (ID: ${existing.id}). Skipping...\n`);
        continue;
      }

      // Insert the template
      const { data, error } = await supabase
        .from('templates')
        .insert({
          name: template.base.name,
          description: template.base.description,
          category,
          icon,
          is_global: true,
          created_by: null, // System templates have no creator
          template_data: template
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      console.log(`   ✅ Created template "${template.base.name}" (ID: ${data.id})`);
      console.log(`      - Category: ${category}`);
      console.log(`      - Tables: ${template.tables.length}`);
      console.log(`      - Fields: ${template.fields.length}`);
      console.log(`      - Records: ${template.records?.length || 0}\n`);
    } catch (error) {
      console.error(`   ❌ Failed to create template "${template.base.name}":`, error);
      console.error('');
    }
  }

  console.log('✨ Template seeding completed!');
}

// Run the seeding script
seedTemplates()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Seeding failed:', error);
    process.exit(1);
  });


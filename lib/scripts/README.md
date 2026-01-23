# Database Scripts

This directory contains utility scripts for managing the database.

## Seeding Global Templates

The `seed-templates.ts` script populates the database with predefined global templates.

### Prerequisites

1. Make sure you have the Supabase service role key
2. Add it to your `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

### Running the Script

The script will automatically load environment variables from `.env.local`:

```bash
npx tsx lib/scripts/seed-templates.ts
```

**Alternative:** If you prefer, you can pass environment variables directly:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co SUPABASE_SERVICE_ROLE_KEY=your_key npx tsx lib/scripts/seed-templates.ts
```

**On Windows PowerShell:**

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="your_key"; npx tsx lib/scripts/seed-templates.ts
```

### What it does

The script will:
- Create all predefined templates from `lib/data/predefined-templates.ts`
- Set them as global templates (visible to all users)
- Skip templates that already exist (based on name)
- Output progress and results

### Templates Created

The following templates will be created:
- **Real Estate CRM** - Contact tracking, property listings, deal pipeline
- **Project Management** - Projects, tasks, team members, milestones
- **Inventory Management** - Products, suppliers, orders, stock movements
- **Event Planning** - Events, attendees, vendors, budget tracking
- **Content Calendar** - Content pieces, authors, campaigns, analytics

Each template includes:
- Complete table structures
- Field definitions with proper types
- Sample data records
- Recommended automations (where applicable)

### Troubleshooting

If you encounter errors:
1. Verify your Supabase URL and service role key are correct
2. Ensure the `templates` table exists (run migrations first)
3. Check that the service role key has proper permissions
4. Review the error messages for specific issues

### Note

This script uses the Supabase service role key which bypasses Row Level Security (RLS). Only run this script in development or with proper authorization in production environments.


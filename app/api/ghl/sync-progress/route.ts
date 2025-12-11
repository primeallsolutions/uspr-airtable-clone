import { NextRequest, NextResponse } from 'next/server';

// In-memory store for sync progress (keyed by baseId)
// In production, this could be stored in Redis or database
const syncProgressStore = new Map<string, {
  current: number;
  total: number;
  phase: 'fetching' | 'syncing';
  startedAt: string;
}>();

/**
 * GET /api/ghl/sync-progress
 * Get current sync progress for a base
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const baseId = searchParams.get('base_id');

    if (!baseId) {
      return NextResponse.json(
        { error: 'base_id is required' },
        { status: 400 }
      );
    }

    const progress = syncProgressStore.get(baseId);

    if (!progress) {
      return NextResponse.json({
        success: true,
        progress: null,
      });
    }

    return NextResponse.json({
      success: true,
      progress: {
        current: progress.current,
        total: progress.total,
        phase: progress.phase,
        startedAt: progress.startedAt,
      },
    });
  } catch (error) {
    console.error('GHL sync progress error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ghl/sync-progress
 * Update sync progress (called internally by sync endpoint)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseId, current, total, phase } = body;

    if (!baseId) {
      return NextResponse.json(
        { error: 'base_id is required' },
        { status: 400 }
      );
    }

    if (current === null || total === null) {
      // Clear progress
      syncProgressStore.delete(baseId);
    } else {
      // Update progress
      const existing = syncProgressStore.get(baseId);
      syncProgressStore.set(baseId, {
        current,
        total,
        phase: phase || 'syncing',
        startedAt: existing?.startedAt || new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('GHL sync progress update error:', error);
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }
}


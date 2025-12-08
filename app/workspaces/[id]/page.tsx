"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ChevronDown, 
  Search, 
  Filter, 
  SortAsc, 
  Settings, 
  Share2, 
  ExternalLink,
  ChevronLeft,
  Plus,
  X,
  List,
  Grid3X3,
  Upload,
  Edit3,
  Check,
  Database
} from "lucide-react";

type SupabaseUser = { id: string; email?: string };
type Workspace = { id: string; name: string };
type Base = { id: string; name: string; description: string | null; created_at: string; last_opened_at: string | null };

// Mock data for the demo interface

// Sample data for the table
const tableData = [
  {
    id: 1,
    firstName: 'Jhonnel',
    lastName: 'Garcia',
    status: 'Seller',
    address: "Brooke's Point, Palawan",
    email: 'jhonnelgarcia.dev@gmail.com',
    birthday: '08/04/2001',
    urgency: 'Urgent'
  },
  {
    id: 2,
    firstName: 'Harry',
    lastName: 'Cabrera',
    status: 'Buyer',
    address: 'PPC, Palawan',
    email: 'harry@gmail.com',
    birthday: '10/13/2002',
    urgency: 'Mid Priority'
  },
  {
    id: 3,
    firstName: 'Ester',
    lastName: 'Nunay',
    status: 'On Contract',
    address: 'San Pedro, PPC, Palawan',
    email: 'ester@gmail.com',
    birthday: '07/13/1980',
    urgency: 'Super Urgent'
  },
  {
    id: 4,
    firstName: 'Anna',
    lastName: 'Calapini',
    status: 'Renter',
    address: 'Cavite',
    email: 'anna@gmail.com',
    birthday: '07/13/1978',
    urgency: 'Not Priority'
  },
  {
    id: 5,
    firstName: 'James',
    lastName: 'Bond',
    status: 'Buyer',
    address: '',
    email: '',
    birthday: '',
    urgency: 'Mid Priority'
  }
];

const kanbanColumns = [
  { id: 'uncategorized', title: 'Uncategorized', count: 1, items: [
    { id: '1', name: 'Unnamed buyer' }
  ]},
  { id: 'new-buyer', title: 'New Buyer', count: 3, items: [
    { id: '2', name: 'Marlin' },
    { id: '3', name: 'Perci Marin' },
    { id: '4', name: 'Noel' },
  ]},
  { id: 'waiting-documents', title: 'Waiting for Documents', count: 0, items: [] },
  { id: 'not-yet', title: 'Not Yet', count: 0, items: [] },
];

export default function WorkspacePage() {
  const params = useParams<{ id: string }>();
  const workspaceId = useMemo(() => (Array.isArray(params?.id) ? params.id[0] : params?.id), [params]);
  const router = useRouter();

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentView, setCurrentView] = useState<'grid' | 'kanban'>('grid');
  
  // New state for workspace editing and base creation
  const [isEditingWorkspaceName, setIsEditingWorkspaceName] = useState(false);
  const [editedWorkspaceName, setEditedWorkspaceName] = useState('');
  const [isCreateBaseModalOpen, setIsCreateBaseModalOpen] = useState(false);
  const [baseName, setBaseName] = useState('');
  const [baseDescription, setBaseDescription] = useState('');
  const [creatingBase, setCreatingBase] = useState(false);
  const [bases, setBases] = useState<Base[]>([]);
  const [loadingBases, setLoadingBases] = useState(false);
  const [baseCreationError, setBaseCreationError] = useState<string | null>(null);

  const checkUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setUser({ id: user.id, email: user.email ?? undefined });
  }, [router]);

  const loadWorkspace = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const { data: ws, error: wsErr } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("id", workspaceId)
      .single();
    if (wsErr || !ws) { setWorkspace(null); setLoading(false); return; }
    setWorkspace(ws as Workspace);
    setEditedWorkspaceName(ws.name); // Initialize edited name
    setLoading(false);
  }, [workspaceId]);

  const loadBases = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingBases(true);
    const { data, error } = await supabase
      .from('bases')
      .select('id, name, description, created_at, last_opened_at')
      .eq('workspace_id', workspaceId)
      .order('last_opened_at', { ascending: false, nullsFirst: false });
    if (!error && data) {
      setBases(data as Base[]);
    }
    setLoadingBases(false);
  }, [workspaceId]);

  const handleSaveWorkspaceName = useCallback(async () => {
    if (!workspace || !editedWorkspaceName.trim()) return;
    
    const { error } = await supabase
      .from("workspaces")
      .update({ name: editedWorkspaceName.trim() })
      .eq("id", workspace.id);
    
    if (!error) {
      setWorkspace({ ...workspace, name: editedWorkspaceName.trim() });
      setIsEditingWorkspaceName(false);
    }
  }, [workspace, editedWorkspaceName]);

  const handleCreateBase = useCallback(async () => {
    if (!baseName.trim() || !workspaceId) {
      setBaseCreationError("Please provide a name.");
      return;
    }
    setBaseCreationError(null);
    setCreatingBase(true);

    try {
      // 1) Create Base
      const { data: baseInsertData, error: baseInsertError } = await supabase
        .from("bases")
        .insert({ name: baseName.trim(), description: baseDescription || null, workspace_id: workspaceId })
        .select("id")
        .single();

      if (baseInsertError || !baseInsertData) {
        throw new Error(baseInsertError?.message || "Failed to create base");
      }

      const baseId = baseInsertData.id as string;

      // 2) Create masterlist Table (always first table)
      const { data: tableInsertData, error: tableInsertError } = await supabase
        .from("tables")
        .insert({ base_id: baseId, name: "masterlist", order_index: 0, is_master_list: true })
        .select("id")
        .single();

      if (tableInsertError || !tableInsertData) {
        throw new Error(tableInsertError?.message || "Failed to create default table");
      }

      const tableId = tableInsertData.id as string;

      // 3) Create default Fields
      const { error: fieldsInsertError } = await supabase.from("fields").insert([
        { table_id: tableId, name: "Name", type: "text", order_index: 0, options: {} },
        { table_id: tableId, name: "Notes", type: "text", order_index: 1, options: {} },
        { table_id: tableId, name: "Assignee", type: "text", order_index: 2, options: { inputType: "email" } },
        { table_id: tableId, name: "Status", type: "single_select", order_index: 3, options: { choices: ["Todo", "In progress", "Done"] } },
        { table_id: tableId, name: "Attachments", type: "text", order_index: 4, options: {} },
        { table_id: tableId, name: "Attachment Summary", type: "text", order_index: 5, options: {} },
      ]);

      if (fieldsInsertError) {
        throw new Error(fieldsInsertError.message || "Failed to create default fields");
      }

      // Reset form and close modal
      setBaseName("");
      setBaseDescription("");
      setIsCreateBaseModalOpen(false);

      // Reload bases
      void loadBases();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong creating the base.";
      setBaseCreationError(message);
    } finally {
      setCreatingBase(false);
    }
  }, [baseName, baseDescription, workspaceId, loadBases]);

  useEffect(() => { checkUser(); }, [checkUser]);
  useEffect(() => { 
    if (user) { 
      void loadWorkspace(); 
      void loadBases();
    } 
  }, [user, loadWorkspace, loadBases]);

  const handleFileUpload = useCallback((file: File) => {
    if (file.type !== 'text/csv') {
      alert('Please select a CSV file');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('File size must be less than 10MB');
      return;
    }
    
    // Handle file upload logic here
    console.log('Processing CSV file:', file);
    
    // For now, just close the modal
    setIsImportModalOpen(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="text-center">
          <h1 className="mb-2 text-xl font-semibold text-gray-900">Workspace not found</h1>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Previewing as</span>
            <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
              <span className="w-4 h-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">i</span>
              <span>Yourself</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
          <span className="text-sm text-gray-500">No changes - Last published Nov 17, 2024</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
            Publish
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
            <Share2 className="w-4 h-4" />
            Share interface
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">
            <ExternalLink className="w-4 h-4" />
            Open
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className={`bg-blue-50 transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
          <div className="p-4">
            <button 
              onClick={() => setIsCreateBaseModalOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
            >
              <Plus className="w-4 h-4" />
              {!sidebarCollapsed && "Create base"}
            </button>
          </div>
          
          <div className="px-4">
            <div className="flex items-center justify-between mb-2">
              {!sidebarCollapsed && (
                <div className="flex items-center gap-2 flex-1">
                  {isEditingWorkspaceName ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        value={editedWorkspaceName}
                        onChange={(e) => setEditedWorkspaceName(e.target.value)}
                        className="flex-1 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded px-2 py-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveWorkspaceName();
                          if (e.key === 'Escape') {
                            setIsEditingWorkspaceName(false);
                            setEditedWorkspaceName(workspace?.name || '');
                          }
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleSaveWorkspaceName}
                        className="p-1 text-green-600 hover:text-green-700"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingWorkspaceName(false);
                          setEditedWorkspaceName(workspace?.name || '');
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-xs font-medium text-gray-900 uppercase tracking-wide truncate">
                        {workspace?.name || 'Workspace'}
                      </span>
                      <button
                        onClick={() => setIsEditingWorkspaceName(true)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="space-y-1">
              {!sidebarCollapsed && (
                <div className="mb-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Bases</span>
                </div>
              )}
              
              {loadingBases ? (
                !sidebarCollapsed && (
                  <div className="px-2 py-2 text-sm text-gray-500">Loading bases...</div>
                )
              ) : bases.length === 0 ? (
                !sidebarCollapsed && (
                  <div className="px-2 py-2 text-sm text-gray-500">No bases yet</div>
                )
              ) : (
                bases.map((base) => (
                  <Link
                    key={base.id}
                    href={`/bases/${base.id}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors text-gray-700 hover:bg-gray-100"
                  >
                    <Database className="w-4 h-4 text-gray-500" />
                    {!sidebarCollapsed && <span className="truncate">{base.name}</span>}
                  </Link>
                ))
              )}
              
              {/* View Switcher */}
              {!sidebarCollapsed && bases.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">View Options</span>
                  </div>
                  <div className="space-y-1">
                    <button
                      onClick={() => setCurrentView('grid')}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                        currentView === 'grid' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Grid3X3 className="w-4 h-4" />
                      Grid view
                    </button>
                    <button
                      onClick={() => setCurrentView('kanban')}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                        currentView === 'kanban' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <List className="w-4 h-4" />
                      Kanban
                    </button>
                    <Link
                      href={`/workspaces/${workspaceId}/activity`}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors text-gray-700 hover:bg-gray-100"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Activity
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
              >
                <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
              </button>
              {!sidebarCollapsed && (
                <button className="text-xs text-gray-500 hover:text-gray-700">
                  Share Interface Designer feedback
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Table Header (for Grid View) */}
          {currentView === 'grid' && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-semibold text-gray-900">Total Deals(Master Leads)</h1>
                <span className="text-sm text-gray-500">{tableData.length} records</span>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors border border-blue-200"
                >
                  <Upload className="w-4 h-4" />
                  Import
                </button>
              </div>
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md">
                  <Filter className="w-4 h-4" />
                  Filter by...
                </button>
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md">
                  <SortAsc className="w-4 h-4" />
                  Sort by...
                </button>
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Breadcrumbs and Actions (for Kanban View) */}
          {currentView === 'kanban' && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span>Client Tracker</span>
                <span>›</span>
                <span className="text-gray-900 font-medium">Buyers Workflow</span>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  Import
                </button>
              </div>
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
                  <Filter className="w-4 h-4" />
                  Filter
                </button>
                <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
                  <SortAsc className="w-4 h-4" />
                  Sort
                </button>
                <button className="text-gray-600 hover:text-gray-800">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Grid View */}
          {currentView === 'grid' && (
            <div className="flex-1 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">First Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Birthday</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Urgency</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {tableData.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.firstName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.lastName}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select 
                            className={`px-3 py-1 text-sm rounded-md border-0 ${
                              row.status === 'Seller' ? 'bg-orange-100 text-orange-800' :
                              row.status === 'Buyer' ? 'bg-red-100 text-red-800' :
                              row.status === 'On Contract' ? 'bg-blue-100 text-blue-800' :
                              row.status === 'Renter' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}
                            defaultValue={row.status}
                          >
                            <option value="Seller">Seller</option>
                            <option value="Buyer">Buyer</option>
                            <option value="On Contract">On Contract</option>
                            <option value="Renter">Renter</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{row.address || 'Enter text...'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{row.email || 'Enter email address...'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.birthday || 'mm/dd/yyyy'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-md ${
                            row.urgency === 'Urgent' ? 'bg-red-100 text-red-800' :
                            row.urgency === 'Super Urgent' ? 'bg-red-200 text-red-900' :
                            row.urgency === 'Mid Priority' ? 'bg-yellow-100 text-yellow-800' :
                            row.urgency === 'Not Priority' ? 'bg-gray-100 text-gray-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {row.urgency}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {/* Add row */}
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Plus className="w-4 h-4 text-gray-400" />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">Add row</td>
                      <td className="px-6 py-4 text-sm text-orange-500">Complete the last row before adding a new one</td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4"></td>
                      <td className="px-6 py-4"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Kanban Board */}
          {currentView === 'kanban' && (
            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-6 p-6 min-w-max h-full">
                {kanbanColumns.map((column) => (
                  <div key={column.id} className="flex-shrink-0 w-80">
                                       {/* Column Header */}
                     <div className="flex items-center justify-between mb-4">
                       <div className="flex items-center gap-3">
                         <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                           column.id === 'uncategorized' ? 'bg-gray-100 text-gray-700' :
                           column.id === 'new-buyer' ? 'bg-orange-100 text-orange-700' :
                           column.id === 'waiting-documents' ? 'bg-red-100 text-red-700' :
                           column.id === 'not-yet' ? 'bg-blue-100 text-blue-700' :
                           'bg-gray-100 text-gray-700'
                         }`}>
                           {column.title}
                         </div>
                         <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                           {column.count}
                         </span>
                       </div>
                     </div>

                    {/* Cards Container */}
                    <div className="space-y-3 min-h-[200px] bg-gray-50/30 rounded-lg p-3">
                      {column.items.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          No buyers
                        </div>
                      ) : (
                        column.items.map((item) => (
                          <div
                            key={item.id}
                            className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all"
                          >
                            <div className="font-medium text-gray-900">{item.name}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Page &gt; Kanban</h2>
            
            <div className="space-y-6">
              {/* Data */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Data</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Source</label>
                    <div className="flex items-center gap-2">
                      <select className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Buyers Workflow</option>
                      </select>
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Filter by</label>
                    <div className="flex items-center gap-2">
                      <select className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>None</option>
                      </select>
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Stacking field</label>
                    <div className="flex items-center gap-2">
                      <select className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>STATUS</option>
                      </select>
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Sort by</label>
                    <div className="flex items-center gap-2">
                      <select className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>None</option>
                      </select>
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Fields</label>
                    <div className="flex items-center gap-2">
                      <span className="flex-1 px-3 py-2 text-sm text-gray-700">1 visible</span>
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Image field</label>
                    <div className="flex items-center gap-2">
                      <select className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>None</option>
                      </select>
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Appearance */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Appearance</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Color</label>
                    <div className="flex items-center gap-2">
                      <select className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option>None</option>
                      </select>
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Wrap long cell values</span>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Hide empty stacks</span>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                    </button>
                  </div>
                </div>
              </div>

              {/* User actions */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">User actions</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Edit records inline</span>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Add/delete records inline</span>
                    <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Click into record details</label>
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <Settings className="w-4 h-4" />
                      </button>
                      <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Import CSV File</h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  Upload a CSV file to import data into your table. Make sure your CSV file has headers that match your table fields.
                </p>
                
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragOver 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {isDragOver ? 'Drop your CSV file here' : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-gray-500">CSV files only</p>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    id="csv-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload(file);
                      }
                    }}
                  />
                  <label
                    htmlFor="csv-upload"
                    className="inline-block mt-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 cursor-pointer"
                  >
                    Choose File
                  </label>
                </div>
              </div>
              
              <div className="text-xs text-gray-500">
                <p className="mb-2"><strong>Tips:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>First row should contain column headers</li>
                  <li>Make sure data types match your table fields</li>
                  <li>Maximum file size: 10MB</li>
                </ul>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Base Modal */}
      {isCreateBaseModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create Base</h3>
              <button
                onClick={() => {
                  setIsCreateBaseModalOpen(false);
                  setBaseName('');
                  setBaseDescription('');
                  setBaseCreationError(null);
                }}
                className="text-gray-400 hover:text-gray-600"
                disabled={creatingBase}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Base Name</label>
                  <input
                    type="text"
                    value={baseName}
                    onChange={(e) => setBaseName(e.target.value)}
                    placeholder="e.g., Customer Management"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={creatingBase}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                  <textarea
                    value={baseDescription}
                    onChange={(e) => setBaseDescription(e.target.value)}
                    placeholder="Describe what this base is for..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={creatingBase}
                  />
                </div>
                
                {baseCreationError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                    {baseCreationError}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsCreateBaseModalOpen(false);
                  setBaseName('');
                  setBaseDescription('');
                  setBaseCreationError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={creatingBase}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBase}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={creatingBase || !baseName.trim()}
              >
                {creatingBase ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </div>
                ) : (
                  'Create Base'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



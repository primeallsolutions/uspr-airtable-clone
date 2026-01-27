# **Accelerated Project Plan: AppFiles Clone MVP**

Strategy: Parallel Execution (Frontend/Backend) & Deep Integration

## **1\. Executive Summary & Strategy**

This project plan supersedes previous versions by compressing the timeline from 9 weeks to 6 weeks. This acceleration is achieved by splitting development into two parallel tracks: **Track A (Frontend Experience)** and **Track B (Backend & Integration)**.

Crucial Architecture Shift:  
The AppFiles Clone is no longer a standalone silo. It is strictly an Extension Layer built on top of your existing "Airtable Clone."

* **The Airtable Clone** is the *Source of Truth* for Data (Transactions, Contacts, Property Details).  
* **The AppFiles Clone** is the *Source of Truth* for Files, Signatures, and Document Workflows.

### **Gap Analysis & Feature Consolidation**

We have merged requirements from the *Technical Gap Analysis* and the *Original Project Plan*:

* **Retained Core:** Folder Management, Drag-and-Drop, PDF Editor (from Original Plan).  
* **Added Critical Gaps:** "Photo Gallery" (distinct from docs) and "Activity Feed" (Real-time updates), identified in the Gap Analysis as essential for the full user experience.

## **2\. System Architecture & Integration**

### **The "Overlay" Model**

The AppFiles MVP will not duplicate data. It will reference the existing Airtable Clone database.

1. **Shared Authentication:** Users log in once (likely via the Airtable Clone). The AppFiles MVP uses the same Auth Token/Session (Supabase Auth shared instance or SSO).  
2. **Data Flow:**  
   * **Read:** AppFiles MVP queries the Airtable Clone DB to fetch Transaction Name, Client Names, and Property Address to populate the File Header.  
   * **Write:** When a document is signed or a task is completed in AppFiles, a status update is pushed back to the specific row in the Airtable Clone (e.g., updating a "Contract Status" column).

graph TD  
    A\[Airtable Clone DB\] \--\>|Read Metadata| B(AppFiles MVP Frontend)  
    B \--\>|Upload/Edit| C\[Supabase Storage bucket: /appfiles\]  
    B \--\>|E-Sign Events| D\[E-Sign Service / Logic\]  
    D \--\>|Write Status| A

## **3\. Detailed User Flows (UX Blueprint)**

These flows define the UI requirements for the development team.

### **Flow 1: Initialization (The Bridge)**

*Trigger:* User is in the Airtable Clone viewing a Transaction Row (e.g., "123 Main St").

1. **Action:** User clicks a button in the Airtable UI: **"Open AppFile"**.  
2. **System:**  
   * Opens AppFiles MVP in a new tab/overlay passing transaction\_id.  
   * Checks if an "AppFile" folder exists in Storage.  
   * If NO: Auto-creates default folder structure (Contracts, Disclosures, Photos) based on Transaction Type (Buyer/Seller).  
   * If YES: Loads the Dashboard.  
3. **Result:** User lands on the **AppFile Dashboard** for "123 Main St".

### **Flow 2: The "File" Dashboard (DMS Command Center)**

*Context:* The main view for a specific transaction.

1. **Layout:**  
   * **Left Sidebar:** Folder Tree (Drag-and-drop sortable).  
   * **Center:** File Grid/List (Thumbnail previews).  
   * **Right Sidebar:** "File Info" (Metadata from Airtable) \+ **Activity Feed** (Real-time logs: "John uploaded Contract.pdf").  
2. **Key Interaction (Upload):**  
   * User drags 5 PDFs from desktop to the "Contracts" folder.  
   * **System:** Uploads sequentially, generates thumbnails, logs event to Activity Feed.  
3. **Key Interaction (Photo Gallery \- *New*):**  
   * User clicks "Photos" tab (separate from Docs).  
   * Uploads high-res property photos.  
   * System displays a Masonry Grid gallery (as requested in Gap Analysis).

### **Flow 3: The "Make Ready" Flow (Editor)**

*Context:* Preparing a raw PDF for signing.

1. **Action:** User clicks a PDF \-\> Selects **"Edit / Split"**.  
2. **UI:** Opens the "Canvas" (Editor View).  
3. **Tools:**  
   * **Split:** User sees page thumbnails. Selects pages 1-3 \-\> Clicks "Extract to New File".  
   * **Merge:** User selects "Add Document" \-\> appends a Disclosure PDF to the end of the Contract.  
   * **Annotate:** User drags a "Text Box" onto Page 5 and types "See Addendum A".  
4. **Save:** Saves as a *new version* (v2), keeping the original (v1) intact for audit history.

### **Flow 4: The Signing Ceremony**

*Context:* Sending a document for signatures.

1. **Setup:** User opens a generic PDF Form.  
2. **Templating:** User drags "Signature Block", "Date Field", and "Initials" onto the PDF coordinates. Assigns them to "Seller 1" and "Buyer 1".  
3. **Routing:** User maps "Seller 1" to a Contact (fetched from Airtable Clone).  
4. **Send:** User clicks "Send for Signature".  
5. **Signer Experience:**  
   * Seller receives Email \-\> Clicks Link.  
   * Opens mobile-responsive signing page (No login required for signer).  
   * Taps to Sign \-\> Clicks Finish.  
6. **Completion:**  
   * System generates a "Certificate of Completion" PDF.  
   * Merges Certificate \+ Signed Doc.  
   * Updates Airtable Clone status column to "Signed".

## **4\. Sprints**

### **Sprint 1: Foundation & The "Box"**

**Goal:** A user can open a Transaction from Airtable, upload files, and see them.

| Track | Task | Deliverable |
| :---- | :---- | :---- |
| **Frontend** | **App Shell & Integration:** Build the "AppFile" layout. Implement the "Open AppFile" bridge from Airtable. | Working Dashboard populated with Airtable Data. |
| **Frontend** | **DMS UI:** Drag-and-drop zones, Folder Tree UI, Grid View. | Functional Upload Interface. |
| **Backend** | **Storage Architecture:** Supabase Storage setup with RLS (Row Level Security). Folder logic. | Secure Bucket structure. |
| **Backend** | **Realtime Sync:** Setup Supabase Realtime for the "Activity Feed". | Live updates when files are added. |

### **Sprint 2: The Tools**

**Goal:** A user can manipulate documents (Split/Merge) and manage Photos.

| Track | Task | Deliverable |
| :---- | :---- | :---- |
| **Frontend** | **PDF Viewer & Editor:** Implement react-pdf / pdf-lib. Allow page re-ordering and splitting. | "Make Ready" Editor UI. |
| **Frontend** | **Photo Gallery:** Dedicated UI for image handling (Grid view, Preview). | Working Photo Tab. |
| **Backend** | **PDF Manipulation Logic:** Server-side functions to physically split/merge PDFs and save new versions. | API endpoints for Split/Merge. |
| **Backend** | **Template Schema:** DB tables for saving "Form Field Locations" (x,y coordinates) for templates. | Database support for templating. |

### **Sprint 3: The Signature & Launch**

**Goal:** A user can send a document for signature and receive it back.

| Track | Task | Deliverable |
| :---- | :---- | :---- |
| **Frontend** | **Signing UI:** Drag-and-drop form builder for placing signature blocks. | E-Sign Request Wizard. |
| **Frontend** | **Guest Signing View:** The simplified mobile-friendly view for the external client. | Client-facing signing page. |
| **Backend** | **Signing Workflow Engine:** State machine for "Sent" \-\> "Viewed" \-\> "Signed". Email dispatching (SendGrid/Resend). | Complete Signing Loop. |
| **Joint** | **QA & Polish:** End-to-end testing of the Airtable \-\> AppFile \-\> Sign \-\> Airtable loop. | **MVP Launch.** |

## **5\. Technical Specifications**

### **Tech Stack**

* **Framework:** Next.js 14 (App Router)  
* **Database/Auth:** Supabase (PostgreSQL) \- *Shared instance with Airtable Clone if possible.*  
* **Styling:** Tailwind CSS \+ Shadcn/UI (for rapid component dev).  
* **PDF Engine:** pdf-lib (Backend manipulation), react-pdf (Frontend rendering).  
* **Drag & Drop:** dnd-kit.

### **Critical Database Schema (AppFiles Layer)**

This schema sits *alongside* your Airtable Clone tables.

**Table: appfiles\_documents**

* id (UUID)  
* transaction\_id (Link to Airtable Clone Record ID)  
* folder\_path (String: e.g., "Contracts/")  
* storage\_path (Supabase Storage reference)  
* version (Int)  
* status (Draft, Pending, Signed)

**Table: appfiles\_activity\_log**

* id  
* transaction\_id  
* user\_id  
* action (e.g., "UPLOAD", "VIEW", "SIGN\_REQUEST")  
* timestamp

## **6\. Risks & Mitigation**

| Risk | Impact | Mitigation Strategy |
| :---- | :---- | :---- |
| **Integration Latency** | Slows down loading the "AppFile" dashboard if Airtable queries are slow. | **Cache Metadata:** Store a lightweight copy of the Transaction Name/Address in the AppFiles DB upon first load, sync only on changes. |
| **PDF Rendering Performance** | Large real estate packets (50+ pages) crash the browser. | **Virtualization:** Use virtualized lists for PDF pages. Generate server-side thumbnails for the Grid view instead of loading full PDFs. |
| **Scope Creep (Email Integration)** | "Email Tracking" (forward to email) is complex and threatens the 6-week timeline. | **Deferment:** Push "Email Ingestion" to Phase 2 (Post-MVP). Focus on Drag-and-Drop upload first. |


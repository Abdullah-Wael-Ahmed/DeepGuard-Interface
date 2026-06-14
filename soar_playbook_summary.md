# SOAR & Visual Playbook Editor — Implementation Summary

## Overview
DeepGuard now possesses Security Orchestration, Automation, and Response (SOAR) capabilities. Analysts can visually draw logical workflows (Playbooks) using a drag-and-drop React Flow builder, allowing DeepGuard to carry out automated actions (like blocking IPs or closing incidents) in response to triggers.

## Components Built

### 1. Backend Orchestration Engine (`server/services/playbookEngine.js`)
- Contains a directed-graph traversal algorithm capable of evaluating playbook triggers, following logic conditions, and resolving actions.
- Automatically captures the payload (`contextData`) traversing the graph and executes mapped functions natively.
- **Available Actions**:
  - `block_ip` — Dynamically isolates the mapped attacker IP by storing it to the DB (which the proxy/Docker firewall then consumes).
  - `close_incident` — Automatically updates Case Management statuses to closed.
- **Auto-execution Hook**: DeepGuard's Incident Creation route natively passes events into `playbookEngine.triggerOnIncident(incident)` letting active playbooks react instantly.

### 2. DeepGuard DB Models
- **`Playbook.js`**: Stores visual React Flow arrays (`nodes` and `edges`) directly as JSON objects alongside workflow execution metadata (trigger rules, status).
- **`PlaybookExecution.js`**: Keeps a detailed historical timeline audit of every time the engine ran a Playbook, recording whether actions succeeded or failed with step-by-step logs.

### 3. Visual Designer (`front/src/pages/PlaybookBuilder.jsx`)
- Implemented `@xyflow/react` to provide an interactive grid where analysts map logic using 3 custom interactive nodes:
  - **Trigger Node (Purple)**: Determines how the execution begins (e.g. `On Incident Created`).
  - **Condition Node (Yellow/Diamond)**: Splits the logic map into `True` or `False` branches by evaluating `contextData` using operators like `==`, `!=`, or `contains`.
  - **Action Node (Blue)**: Defines the resolution payload (e.g., Block Firewall).
- Features a right-hand sidebar that dynamically targets the currently clicked node and reveals configuration properties.

### 4. Playbooks Dashboard (`front/src/pages/Playbooks.jsx`)
- Built a management view displaying historical active metrics (Total Executions, Active Workflows) and a table of configurable drafted or active playbooks.
- Clicking "New Playbook" seeds a generic Trigger Node into a draft and opens the canvas for mapping.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, Handle, Position, Panel } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save, Play, ArrowLeft, Plus, Settings2, Trash2, Zap, ShieldAlert, Activity, GitCommit, Search, Shield, Bell } from 'lucide-react';

const BACK = import.meta.env.VITE_BACK;

// ── CUSTOM NODES ──
const TriggerNode = ({ data, isConnectable }) => (
  <div className="bg-[#1e1e2e] border-2 border-purple-500 rounded-xl p-4 w-64 shadow-[0_0_15px_rgba(168,85,247,0.15)] relative">
    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-700/50">
      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
          <Zap size={18} />
      </div>
      <div>
        <div className="text-purple-400 font-bold text-xs uppercase tracking-wider">Trigger</div>
        <div className="text-white text-sm font-medium">{data.label || 'On Incident Created'}</div>
      </div>
    </div>
    <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="w-3 h-3 bg-purple-500 border-2 border-[#1e1e2e]" />
  </div>
);

const ActionNode = ({ data, isConnectable }) => {
  const getIcon = (cat) => {
    if(cat === 'response') return <ShieldAlert size={16} />;
    if(cat === 'enrichment') return <Search size={16} />;
    if(cat === 'notification') return <Bell size={16} />;
    return <Activity size={16} />;
  };
  return (
  <div className="bg-[#1e1e2e] border-2 border-blue-500 rounded-xl p-4 w-64 shadow-[0_0_15px_rgba(59,130,246,0.15)] relative group">
    <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="w-3 h-3 bg-blue-500 border-2 border-[#1e1e2e]" />
    <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-700/50">
      <div className="flex items-center gap-3">
         <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
             {getIcon(data.category)}
         </div>
         <div>
            <div className="text-blue-400 font-bold text-xs uppercase tracking-wider">Action</div>
            <div className="text-white text-sm font-medium truncate w-32" title={data.actionLabel || data.actionType || 'Block IP'}>{data.actionLabel || data.actionType || 'Block IP'}</div>
         </div>
      </div>
      <button onClick={data.onDelete} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"><Trash2 size={16}/></button>
    </div>
    <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="w-3 h-3 bg-blue-500 border-2 border-[#1e1e2e]" />
  </div>
)};

const ConditionNode = ({ data, isConnectable }) => (
  <div className="bg-[#1e1e2e] border-2 border-yellow-500 rounded-xl p-4 w-64 shadow-[0_0_15px_rgba(234,179,8,0.15)] relative group">
    <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="w-3 h-3 bg-yellow-500 border-2 border-[#1e1e2e]" />
    <div className="flex justify-between items-start mb-3 pb-3 border-b border-gray-700/50">
      <div className="flex items-center gap-3">
         <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400">
             <GitCommit size={18} className="rotate-90" />
         </div>
         <div>
            <div className="text-yellow-400 font-bold text-xs uppercase tracking-wider">Condition</div>
            <div className="text-white text-sm font-medium truncate w-32" title={`${data.conditionField} ${data.conditionOperator} ${data.conditionValue}`}>{data.conditionField} {data.conditionOperator} {data.conditionValue}</div>
         </div>
      </div>
      <button onClick={data.onDelete} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"><Trash2 size={16}/></button>
    </div>
    
    <Handle type="source" position={Position.Bottom} id="true" isConnectable={isConnectable} className="w-3 h-3 bg-green-500 border-2 border-[#1e1e2e] left-1/3" />
    <div className="absolute -bottom-6 left-1/3 -ml-3 text-xs text-green-500 font-bold">True</div>
    
    <Handle type="source" position={Position.Bottom} id="false" isConnectable={isConnectable} className="w-3 h-3 bg-red-500 border-2 border-[#1e1e2e] left-2/3" />
    <div className="absolute -bottom-6 left-2/3 -ml-3 text-xs text-red-500 font-bold">False</div>
  </div>
);

const nodeTypes = { triggerNode: TriggerNode, actionNode: ActionNode, conditionNode: ConditionNode };

// ── PLAYBOOK BUILDER COMPONENT ──
const PlaybookBuilder = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [playbook, setPlaybook] = useState(null);
    const [loading, setLoading] = useState(true);
    
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [availableActions, setAvailableActions] = useState([]);
    
    // Sidebar forms
    const [selectedNode, setSelectedNode] = useState(null);

    const loadPlaybook = async () => {
        try {
            const [pbRes, actionsRes] = await Promise.all([
                axios.get(`${BACK}/playbooks/${id}`, { withCredentials: true }),
                axios.get(`${BACK}/playbooks/actions`, { withCredentials: true })
            ]);
            const pb = pbRes.data;
            setAvailableActions(actionsRes.data);
            setPlaybook(pb);
            
            // Re-attach delete handlers to loaded nodes
            const enrichedNodes = (pb.nodes || []).map(n => ({
                ...n,
                data: { ...n.data, onDelete: () => handleDeleteNode(n.id) }
            }));
            
            setNodes(enrichedNodes);
            setEdges(pb.edges || []);
        } catch (error) {
            toast.error("Failed to load playbook");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlaybook();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const onConnect = useCallback((params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#a855f7', strokeWidth: 2 } }, eds)), [setEdges]);

    const handleDeleteNode = useCallback((nodeId) => {
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
        setSelectedNode(null);
    }, [setNodes, setEdges]);

    const handleNodeClick = (_, node) => setSelectedNode(node);
    const handlePaneClick = () => setSelectedNode(null);

    const savePlaybook = async () => {
        try {
            // Strip functions from node data before saving
            const cleanNodes = nodes.map(n => {
                const { onDelete, ...cleanData } = n.data;
                return { ...n, data: cleanData };
            });

            await axios.put(`${BACK}/playbooks/${id}`, {
                ...playbook,
                nodes: cleanNodes,
                edges
            }, { withCredentials: true });
            
            toast.success("Playbook saved!");
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to save playbook");
            console.error("Save error:", error.response?.data);
        }
    };

    const deletePlaybook = async () => {
        if (!window.confirm("Are you sure you want to delete this playbook?")) return;
        try {
            await axios.delete(`${BACK}/playbooks/${id}`, { withCredentials: true });
            toast.success("Playbook deleted");
            navigate('/playbooks');
        } catch (error) {
            toast.error("Failed to delete playbook");
        }
    };

    const addActionNode = () => {
        const newNodeId = `action_${Date.now()}`;
        const defaultAction = availableActions[0] || { value: 'block_ip', label: 'Block IP', category: 'response' };
        const newNode = {
            id: newNodeId,
            type: 'actionNode',
            position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 200 },
            data: { actionType: defaultAction.value, actionLabel: defaultAction.label, category: defaultAction.category, onDelete: () => handleDeleteNode(newNodeId) }
        };
        setNodes((nds) => nds.concat(newNode));
    };

    const addConditionNode = () => {
        const newNodeId = `condition_${Date.now()}`;
        const newNode = {
            id: newNodeId,
            type: 'conditionNode',
            position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 200 },
            data: { conditionField: 'severity', conditionOperator: '==', conditionValue: 'critical', onDelete: () => handleDeleteNode(newNodeId) }
        };
        setNodes((nds) => nds.concat(newNode));
    };

    const updateNodeData = (field, value) => {
        if (!selectedNode) return;
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id === selectedNode.id) {
                    return { ...n, data: { ...n.data, [field]: value } };
                }
                return n;
            })
        );
        // Also update local selectedNode state so sidebar reflects it immediately
        setSelectedNode(prev => ({ ...prev, data: { ...prev.data, [field]: value } }));
    };

    const testExecution = async () => {
        try {
            toast.info("Firing execution...");
            const res = await axios.post(`${BACK}/playbooks/${id}/execute`, { src_ip: '10.0.0.99', severity: 'critical', incidentId: 1001 }, { withCredentials: true });
            if (res.data.status === 'success') {
                toast.success("Execution completed! Check server logs.");
            } else {
                toast.warning(`Execution finished with status: ${res.data.status}`);
            }
        } catch (error) {
            toast.error(error.response?.data?.error || "Execution failed!");
        }
    };

    if (loading) return <div className="p-8 text-white">Loading Editor...</div>;

    return (
        <div className="flex flex-col h-full bg-[#0f0f13] overflow-hidden">
            {/* Top Toolbar */}
            <div className="h-16 bg-[#1a1a24] border-b border-gray-800 flex items-center justify-between px-6 shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/playbooks')} className="p-2 border border-gray-700 rounded-md hover:bg-gray-800 text-gray-300">
                        <ArrowLeft size={16} />
                    </button>
                    <div>
                        <input 
                            type="text" 
                            className="bg-transparent text-white font-bold text-lg focus:outline-none focus:border-b focus:border-primary px-1"
                            value={playbook?.name || ''}
                            onChange={(e) => setPlaybook({...playbook, name: e.target.value})}
                        />
                        <div className="flex items-center gap-2 mt-0.5 px-1 pb-1">
                            <span className={`w-2 h-2 rounded-full ${playbook?.status === 'active' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-500'}`}></span>
                            <select 
                                className="bg-transparent text-xs text-gray-400 focus:outline-none uppercase tracking-wider font-medium cursor-pointer"
                                value={playbook?.status || 'draft'}
                                onChange={(e) => setPlaybook({...playbook, status: e.target.value})}
                            >
                                <option value="draft">Draft</option>
                                <option className="text-green-500" value="active">Active</option>
                                <option className="text-red-500" value="disabled">Disabled</option>
                            </select>
                        </div>
                    </div>
                    {playbook?.runCounter > 0 && (
                        <div className="bg-gray-800 border border-gray-700 px-3 py-1 rounded-full text-xs font-mono text-gray-300 ml-4 flex items-center gap-1.5 shadow-inner">
                            <Activity size={12} className="text-primary"/>
                            {playbook.runCounter} executions
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-3">
                    <button onClick={deletePlaybook} className="p-2 border border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-lg transition" title="Delete Playbook">
                        <Trash2 size={16} />
                    </button>
                    <button onClick={testExecution} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-lg flex items-center gap-2 transition text-sm">
                        <Play size={16} className="text-green-400" /> Test Run
                    </button>
                    <button onClick={savePlaybook} className="px-4 py-2 bg-primary hover:bg-primary-dark text-background-dark font-medium rounded-lg flex items-center gap-2 transition glow-sm text-sm">
                        <Save size={16} /> Save Workflow
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Visual Editor Canvas */}
                <div className="flex-1 w-full h-full relative" style={{ width: '100%', height: '100%' }}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        onNodeClick={handleNodeClick}
                        onPaneClick={handlePaneClick}
                        fitView
                        className="bg-[#0f0f13]"
                    >
                        <Background color="#333" gap={20} size={1} />
                        <Controls className="bg-gray-800 border-gray-700 fill-white" />
                        <MiniMap 
                            className="bg-card-dark border border-gray-800 rounded-lg" 
                            nodeColor={(n) => {
                                if (n.type === 'triggerNode') return '#a855f7';
                                if (n.type === 'conditionNode') return '#eab308';
                                return '#3b82f6';
                            }}
                        />
                        <Panel position="top-left" className="bg-[#1a1a24]/90 p-2 rounded-lg border border-gray-800 flex gap-2 backdrop-blur shadow-xl">
                            <button onClick={addActionNode} className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded text-sm flex items-center gap-1 hover:bg-blue-500/20 transition">
                                <Plus size={14}/> Add Action
                            </button>
                            <button onClick={addConditionNode} className="px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 rounded text-sm flex items-center gap-1 hover:bg-yellow-500/20 transition">
                                <Plus size={14}/> Add Condition
                            </button>
                        </Panel>
                    </ReactFlow>
                </div>

                {/* Right Sidebar - Properties Panel */}
                <div className={`w-80 bg-[#1a1a24] border-l border-gray-800 flex flex-col transition-all duration-300 ${selectedNode || playbook ? 'translate-x-0' : 'translate-x-full absolute right-0 h-full'}`}>
                    <div className="p-5 border-b border-gray-800 bg-[#1e1e2e]">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <Settings2 size={18} className="text-primary"/> Properties
                        </h3>
                    </div>
                    
                    <div className="p-5 flex-1 overflow-y-auto space-y-6">
                        {selectedNode ? (
                            // NODE SETTINGS
                            <>
                                <div>
                                    <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-3">{selectedNode.type.split('N')[0]} Settings</h4>
                                </div>

                                {selectedNode.type === 'triggerNode' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Trigger Type</label>
                                            <select 
                                                className="w-full bg-[#0f0f13] border border-gray-700 rounded-md p-2 text-white focus:border-primary focus:outline-none text-sm"
                                                value={playbook?.triggerType || 'manual'}
                                                onChange={(e) => setPlaybook({...playbook, triggerType: e.target.value})}
                                            >
                                                <option value="manual">Manual Execution</option>
                                                <option value="on_incident_created">On Incident Created</option>
                                                <option value="on_alert">On Suricata Alert</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {selectedNode.type === 'actionNode' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Action Type</label>
                                            <select 
                                                className="w-full bg-[#0f0f13] border border-gray-700 rounded-md p-2 text-white focus:border-primary focus:outline-none text-sm"
                                                value={selectedNode.data.actionType || 'block_ip'}
                                                onChange={(e) => {
                                                    const selectedAction = availableActions.find(a => a.value === e.target.value);
                                                    updateNodeData('actionType', e.target.value);
                                                    updateNodeData('actionLabel', selectedAction?.label);
                                                    updateNodeData('category', selectedAction?.category);
                                                }}
                                            >
                                                {Object.entries(
                                                    availableActions.reduce((acc, action) => {
                                                        const cat = action.category || 'other';
                                                        if (!acc[cat]) acc[cat] = [];
                                                        acc[cat].push(action);
                                                        return acc;
                                                    }, {})
                                                ).map(([category, actions]) => (
                                                    <optgroup key={category} label={category.toUpperCase().replace('_', ' ')}>
                                                        {actions.map(action => (
                                                            <option key={action.value} value={action.value}>{action.label}</option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                                            <p className="text-xs text-blue-400">This action will execute automatically if the workflow reaches this node.</p>
                                        </div>
                                    </div>
                                )}

                                {selectedNode.type === 'conditionNode' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Field to Inspect</label>
                                            <input 
                                                type="text"
                                                className="w-full bg-[#0f0f13] border border-gray-700 rounded-md p-2 text-white focus:border-primary focus:outline-none font-mono text-sm"
                                                value={selectedNode.data.conditionField || ''}
                                                onChange={(e) => updateNodeData('conditionField', e.target.value)}
                                                placeholder="e.g. severity, src_ip"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Operator</label>
                                            <select 
                                                className="w-full bg-[#0f0f13] border border-gray-700 rounded-md p-2 text-white focus:border-primary focus:outline-none text-sm"
                                                value={selectedNode.data.conditionOperator || '=='}
                                                onChange={(e) => updateNodeData('conditionOperator', e.target.value)}
                                            >
                                                <option value="==">Equals (==)</option>
                                                <option value="!=">Not Equals (!=)</option>
                                                <option value=">">Greater Than (&gt;)</option>
                                                <option value="<">Less Than (&lt;)</option>
                                                <option value=">=">Greater or Equal (&gt;=)</option>
                                                <option value="<=">Less or Equal (&lt;=)</option>
                                                <option value="contains">Contains</option>
                                                <option value="not_contains">Not Contains</option>
                                                <option value="exists">Exists</option>
                                                <option value="regex">Regex Match</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-1">Value</label>
                                            <input 
                                                type="text"
                                                className="w-full bg-[#0f0f13] border border-gray-700 rounded-md p-2 text-white focus:border-primary focus:outline-none font-mono text-sm"
                                                value={selectedNode.data.conditionValue || ''}
                                                onChange={(e) => updateNodeData('conditionValue', e.target.value)}
                                                placeholder="e.g. critical"
                                            />
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            // GLOBAL PLAYBOOK SETTINGS
                            <>
                                <div>
                                    <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-3">Global Settings</h4>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">MITRE ATT&CK Tags</label>
                                    <input 
                                        type="text"
                                        className="w-full bg-[#0f0f13] border border-gray-700 rounded-md p-2 text-white focus:border-primary focus:outline-none text-sm mb-4"
                                        value={(playbook?.mitreTags || []).join(', ')}
                                        onChange={(e) => setPlaybook({...playbook, mitreTags: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}
                                        placeholder="e.g. T1566, T1041"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Description</label>
                                    <textarea 
                                        className="w-full bg-[#0f0f13] border border-gray-700 rounded-md p-2 text-white focus:border-primary focus:outline-none text-sm h-24 resize-none"
                                        value={playbook?.description || ''}
                                        onChange={(e) => setPlaybook({...playbook, description: e.target.value})}
                                        placeholder="Describe what this automation does..."
                                    />
                                </div>
                                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                                    <p className="text-sm text-gray-300">Click on any node in the canvas to edit its specific properties.</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlaybookBuilder;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, addEdge, Handle, Position, Panel } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save, Play, ArrowLeft, Plus, Settings2, Trash2 } from 'lucide-react';

const BACK = import.meta.env.VITE_BACK;

// ── CUSTOM NODES ──
const TriggerNode = ({ data, isConnectable }) => (
  <div className="bg-[#1e1e2e] border-2 border-purple-500 rounded-lg p-4 w-60 shadow-lg relative">
    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700">
      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
      <div className="text-white font-bold text-sm uppercase tracking-wider">Trigger</div>
    </div>
    <div className="text-gray-300 text-sm">{data.label || 'On Incident Created'}</div>
    <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="w-3 h-3 bg-purple-500" />
  </div>
);

const ActionNode = ({ data, isConnectable }) => (
  <div className="bg-[#1e1e2e] border-2 border-blue-500 rounded-lg p-4 w-60 shadow-lg relative">
    <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="w-3 h-3 bg-blue-500" />
    <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-700">
      <div className="flex items-center gap-2">
         <div className="w-3 h-3 rounded-sm bg-blue-500"></div>
         <div className="text-white font-bold text-sm uppercase tracking-wider">Action</div>
      </div>
      <button onClick={data.onDelete} className="text-gray-500 hover:text-red-400"><Trash2 size={14}/></button>
    </div>
    <div className="text-blue-300 font-mono text-xs bg-blue-500/10 p-2 rounded">{data.actionType || 'block_ip'}</div>
    <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="w-3 h-3 bg-blue-500" />
  </div>
);

const ConditionNode = ({ data, isConnectable }) => (
  <div className="bg-[#1e1e2e] border-2 border-yellow-500 rounded-lg p-4 w-60 shadow-lg relative diamond-shape">
    <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="w-3 h-3 bg-yellow-500" />
    <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-700">
      <div className="flex items-center gap-2">
         <div className="w-0 h-0 border-l-[6px] border-l-transparent border-b-[10px] border-b-yellow-500 border-r-[6px] border-r-transparent"></div>
         <div className="text-white font-bold text-sm uppercase tracking-wider">Condition</div>
      </div>
      <button onClick={data.onDelete} className="text-gray-500 hover:text-red-400"><Trash2 size={14}/></button>
    </div>
    <div className="text-yellow-300 font-mono text-xs text-center">{data.conditionField} {data.conditionOperator} {data.conditionValue}</div>
    
    <Handle type="source" position={Position.Bottom} id="true" isConnectable={isConnectable} className="w-3 h-3 bg-green-500 left-1/3" />
    <div className="absolute -bottom-5 left-1/3 -ml-3 text-xs text-green-500 font-bold">True</div>
    
    <Handle type="source" position={Position.Bottom} id="false" isConnectable={isConnectable} className="w-3 h-3 bg-red-500 left-2/3" />
    <div className="absolute -bottom-5 left-2/3 -ml-3 text-xs text-red-500 font-bold">False</div>
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
    
    // Sidebar forms
    const [selectedNode, setSelectedNode] = useState(null);

    const loadPlaybook = async () => {
        try {
            const res = await axios.get(`${BACK}/playbooks/${id}`, { withCredentials: true });
            const pb = res.data;
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
            toast.error("Failed to save playbook");
        }
    };

    const addActionNode = () => {
        const newNodeId = `action_${Date.now()}`;
        const newNode = {
            id: newNodeId,
            type: 'actionNode',
            position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 200 },
            data: { actionType: 'block_ip', onDelete: () => handleDeleteNode(newNodeId) }
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
            toast.error("Execution failed!");
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
                </div>
                
                <div className="flex items-center gap-3">
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
                                                <option value="on_alert">On Raw Alert (High Noise)</option>
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
                                                onChange={(e) => updateNodeData('actionType', e.target.value)}
                                            >
                                                <option value="block_ip">Block Source IP (Firewall)</option>
                                                <option value="close_incident">Close Incident</option>
                                                <option value="notify_slack">Send Notification</option>
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
                                                <option value="contains">Contains</option>
                                                <option value="exists">Exists</option>
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

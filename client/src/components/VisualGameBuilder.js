import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { utils, read } from 'xlsx';
import API_URL, { getUserPlatform } from '../api';
import ConfirmModal from './ConfirmModal';
import { copyText } from '../utils/clipboard';
import './VisualGameBuilder.css';

const genNodeId = () => `n_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
const genChoiceId = () => `c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
const genCharId = () => `ch_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

const AVATAR_PRESETS = ['🧑‍🍳', '👨‍🍳', '👩‍🍳', '🤵', '👰', '👨‍💼', '👩‍💼', '🧑‍💼', '👮', '🧑‍🎓', '👨‍🎓', '👩‍🎓', '🧙', '🦸', '🦹', '🤖', '😊', '👤'];
const COLOR_PRESETS = ['#ff6d5a', '#38bdf8', '#4caf50', '#ff9800', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b'];

const getValidStartNodeId = (nodes = [], preferredStartNodeId = '') => {
    if (nodes.some((node) => node.nodeId === preferredStartNodeId)) {
        return preferredStartNodeId;
    }

    return nodes[0]?.nodeId || null;
};

const AUTO_LAYOUT_START_X = 120;
const AUTO_LAYOUT_START_Y = 120;
const AUTO_LAYOUT_COLUMN_GAP = 360;
const AUTO_LAYOUT_ROW_GAP = 230;
const NODE_CARD_WIDTH = 260;
const NODE_CARD_BASE_HEIGHT = 118;
const NODE_CHOICE_ROW_HEIGHT = 30;

const needsAutoLayout = (nodes = []) => {
    if (nodes.length < 2) {
        return false;
    }

    const occupiedPositions = new Set();
    let duplicatePositions = 0;

    nodes.forEach((node) => {
        const x = Number(node?.x);
        const y = Number(node?.y);
        const key = `${Math.round(Number.isFinite(x) ? x : 0)}:${Math.round(Number.isFinite(y) ? y : 0)}`;

        if (occupiedPositions.has(key)) {
            duplicatePositions += 1;
        } else {
            occupiedPositions.add(key);
        }
    });

    return duplicatePositions > 0;
};

const autoLayoutNodes = (nodes = [], preferredStartNodeId = '') => {
    if (!nodes.length) {
        return [];
    }

    const startNodeId = getValidStartNodeId(nodes, preferredStartNodeId);
    const nodeMap = new Map(nodes.map((node) => [node.nodeId, node]));
    const levelById = new Map();
    const queue = [];
    const visited = new Set();

    if (startNodeId && nodeMap.has(startNodeId)) {
        levelById.set(startNodeId, 0);
        queue.push(startNodeId);
        visited.add(startNodeId);
    }

    while (queue.length > 0) {
        const currentId = queue.shift();
        const currentLevel = levelById.get(currentId) || 0;
        const currentNode = nodeMap.get(currentId);

        (currentNode?.choices || []).forEach((choice) => {
            const nextNodeId = choice?.nextNodeId;
            if (!nextNodeId || !nodeMap.has(nextNodeId) || visited.has(nextNodeId)) {
                return;
            }

            visited.add(nextNodeId);
            levelById.set(nextNodeId, currentLevel + 1);
            queue.push(nextNodeId);
        });
    }

    let fallbackLevel = Math.max(-1, ...Array.from(levelById.values()));
    nodes.forEach((node) => {
        if (!levelById.has(node.nodeId)) {
            fallbackLevel += 1;
            levelById.set(node.nodeId, fallbackLevel);
        }
    });

    const nodesByLevel = new Map();
    nodes.forEach((node, index) => {
        const level = levelById.get(node.nodeId) || 0;
        const levelNodes = nodesByLevel.get(level) || [];
        levelNodes.push({ node, index });
        nodesByLevel.set(level, levelNodes);
    });

    const laidOutNodes = new Map();
    Array.from(nodesByLevel.entries())
        .sort((left, right) => left[0] - right[0])
        .forEach(([level, levelNodes]) => {
            levelNodes.forEach(({ node, index }, rowIndex) => {
                laidOutNodes.set(node.nodeId, {
                    ...node,
                    x: AUTO_LAYOUT_START_X + level * AUTO_LAYOUT_COLUMN_GAP,
                    y: AUTO_LAYOUT_START_Y + rowIndex * AUTO_LAYOUT_ROW_GAP,
                    _order: index
                });
            });
        });

    return nodes
        .map((node, index) => laidOutNodes.get(node.nodeId) || { ...node, _order: index })
        .sort((left, right) => (left._order ?? 0) - (right._order ?? 0))
        .map(({ _order, ...node }) => node);
};

const estimateNodeHeight = (node = {}) => (
    NODE_CARD_BASE_HEIGHT + Math.max((node.choices || []).length, 1) * NODE_CHOICE_ROW_HEIGHT
);

const getNodesBounds = (nodes = []) => {
    if (!nodes.length) {
        return null;
    }

    const bounds = nodes.reduce((accumulator, node) => {
        const x = Number.isFinite(Number(node?.x)) ? Number(node.x) : 0;
        const y = Number.isFinite(Number(node?.y)) ? Number(node.y) : 0;
        const width = NODE_CARD_WIDTH;
        const height = estimateNodeHeight(node);

        return {
            minX: Math.min(accumulator.minX, x),
            minY: Math.min(accumulator.minY, y),
            maxX: Math.max(accumulator.maxX, x + width),
            maxY: Math.max(accumulator.maxY, y + height)
        };
    }, {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
    });

    return {
        ...bounds,
        width: Math.max(bounds.maxX - bounds.minX, NODE_CARD_WIDTH),
        height: Math.max(bounds.maxY - bounds.minY, NODE_CARD_BASE_HEIGHT)
    };
};

const createScenarioDiagnostics = (nodes = [], preferredStartNodeId = '') => {
    const warnings = [];

    if (!nodes.length) {
        warnings.push('Сценарій поки не містить жодного вузла.');
        return warnings;
    }

    const startNodeId = getValidStartNodeId(nodes, preferredStartNodeId);
    if (!preferredStartNodeId || preferredStartNodeId !== startNodeId) {
        warnings.push('Стартовий вузол був відсутній або пошкоджений, редактор підставив резервний.');
    }

    const nodeIds = new Set(nodes.map((node) => node.nodeId));
    const visited = new Set();
    const queue = startNodeId ? [startNodeId] : [];

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (visited.has(currentId)) {
            continue;
        }

        visited.add(currentId);
        const currentNode = nodes.find((node) => node.nodeId === currentId);
        (currentNode?.choices || []).forEach((choice) => {
            if (choice?.nextNodeId && nodeIds.has(choice.nextNodeId) && !visited.has(choice.nextNodeId)) {
                queue.push(choice.nextNodeId);
            }
        });
    }

    const unreachableNodes = nodes.filter((node) => !visited.has(node.nodeId));
    if (unreachableNodes.length > 0) {
        warnings.push(`Недосяжні вузли: ${unreachableNodes.slice(0, 3).map((node) => `"${String(node.text || '').slice(0, 24)}"`).join(', ')}${unreachableNodes.length > 3 ? '…' : ''}.`);
    }

    const nodesWithoutChoices = nodes.filter((node) => (node.choices || []).length === 0);
    if (nodesWithoutChoices.length > 0) {
        warnings.push(`Вузлів без жодного вибору: ${nodesWithoutChoices.length}.`);
    }

    const unfinishedChoices = [];
    nodes.forEach((node) => {
        (node.choices || []).forEach((choice, index) => {
            const hasTarget = Boolean(choice?.nextNodeId);
            const hasResult = Boolean(String(choice?.result || '').trim());
            const hasText = Boolean(String(choice?.text || '').trim());

            if (!hasText) {
                unfinishedChoices.push(`У вузлі "${String(node.text || '').slice(0, 24)}" вибір ${String.fromCharCode(65 + index)} без тексту.`);
                return;
            }

            if (!hasTarget && !hasResult) {
                unfinishedChoices.push(`У вузлі "${String(node.text || '').slice(0, 24)}" вибір ${String.fromCharCode(65 + index)} не має переходу або фіналу.`);
            }
        });
    });

    return warnings.concat(unfinishedChoices.slice(0, 4));
};

const VisualGameBuilder = () => {
    const [scenarios, setScenarios] = useState([]);
    const [editing, setEditing] = useState(null);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const [isDraggingNode, setIsDraggingNode] = useState(false);
    const [draggedNodeId, setDraggedNodeId] = useState(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [copyStatus, setCopyStatus] = useState(null);
    const [linkingFrom, setLinkingFrom] = useState(null);
    const [activeTab, setActiveTab] = useState('canvas');
    const [charForm, setCharForm] = useState(null);
    const [user, setUser] = useState(null);
    const [cities, setCities] = useState([]);
    const [filterCity, setFilterCity] = useState('');
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [saving, setSaving] = useState(false);
    const [nodeHover, setNodeHover] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState(null);
    const [importError, setImportError] = useState('');
    const [importSuccess, setImportSuccess] = useState('');
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, idToDelete: null });

    const canvasRef = useRef(null);
    const minimapRef = useRef(null);
    const fileInputRef = useRef(null);
    const feedbackTimeoutRef = useRef(null);

    useEffect(() => {
        fetchUser();
        fetchScenarios();
        fetchCities();
    }, []);

    const clearFeedback = useCallback(() => {
        if (feedbackTimeoutRef.current) {
            clearTimeout(feedbackTimeoutRef.current);
            feedbackTimeoutRef.current = null;
        }
    }, []);

    const showFeedback = useCallback((message, type = 'success', duration = type === 'success' ? 3000 : 0) => {
        clearFeedback();
        if (type === 'error') {
            setImportSuccess('');
            setImportError(message);
        } else {
            setImportError('');
            setImportSuccess(message);
        }

        if (duration > 0) {
            feedbackTimeoutRef.current = setTimeout(() => {
                setImportError('');
                setImportSuccess('');
                feedbackTimeoutRef.current = null;
            }, duration);
        }
    }, [clearFeedback]);

    const alert = useCallback((message) => {
        showFeedback(String(message || 'Сталася помилка'), 'error');
    }, [showFeedback]);

    useEffect(() => () => clearFeedback(), [clearFeedback]);

    // Відкриваємо модальне вікно коли є дані для імпорту
    // useEffect(() => {
    //     if (importData) {
    //         console.log('useEffect: importData changed, opening modal');
    //         setShowImportModal(true);
    //     }
    // }, [importData]);

    // Діагностика стану модального вікна
    // useEffect(() => {
    //     console.log('Modal state changed:', { showImportModal, importData: !!importData });
    // }, [showImportModal, importData]);

    const fetchUser = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchScenarios = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/game-scenarios`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setScenarios((res.data || []).map((scenario) => ({
                ...scenario,
                targetCity: scenario.targetCity || scenario.city || ''
            })));
        } catch (err) {
            console.error('fetchScenarios:', err);
        }
    };

    const fetchCities = async () => {
        try {
            const res = await axios.get(`${API_URL}/cities${getUserPlatform() ? `?platform=${getUserPlatform()}` : ''}`);
            setCities(res.data);
        } catch (err) { console.error(err); }
    };

    const handleCopyLink = async (id) => {
        if (!id) return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_URL}/game-links`, { scenarioId: id }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await copyText(`${window.location.origin}/game/${res.data.hash}`);
            setCopyStatus(id);
            setTimeout(() => setCopyStatus(null), 3000);
            showFeedback('Посилання скопійовано', 'success', 2000);
        } catch (err) {
            console.error('handleCopyLink:', err);
            alert('Помилка копіювання');
        }
    };

    const handleConfirmDelete = async () => {
        const id = confirmModal.idToDelete;
        if (!id) return;
        setConfirmModal({ isOpen: false, idToDelete: null });
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/game-scenarios/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchScenarios();
            showFeedback('Сценарій видалено', 'success', 2000);
        } catch (err) {
            console.error('Delete error', err);
            alert('Не вдалося видалити сценарій');
        }
    };

    const openNew = () => {
        clearFeedback();
        setImportError('');
        setImportSuccess('');
        setCanvasOffset({ x: 0, y: 0 });
        setZoom(1);
        const startId = genNodeId();
        const nextScenario = normalizeScenario({
            _id: null,
            title: 'Новий сценарій',
            description: '',
            targetCity: '',
            startNodeId: startId,
            characters: [],
            nodes: [{
                nodeId: startId,
                text: 'Початкова сцена\nГість заходить у ресторан...',
                speakerId: null,
                choices: [{ choiceId: genChoiceId(), text: 'Привітати гостя', nextNodeId: null, isWin: false, result: '' }],
                x: 100,
                y: 100
            }]
        });
        setEditing(nextScenario);
        setSelectedNodeId(startId);
        setActiveTab('canvas');
        requestAnimationFrame(() => fitNodesToViewport(nextScenario.nodes));
    };

    const normalizeScenario = (data) => {
        const baseNodes = (data.nodes || []).map((n, i) => ({
            ...n,
            x: n.x ?? (100 + (i % 5) * 280),
            y: n.y ?? 100 + Math.floor(i / 5) * 200,
            speakerId: n.speakerId || null,
            choices: (n.choices || []).map(c => ({
                ...c,
                choiceId: c.choiceId || genChoiceId()
            }))
        }));
        const normalizedNodes = needsAutoLayout(baseNodes)
            ? autoLayoutNodes(baseNodes, data.startNodeId)
            : baseNodes;

        return {
            ...data,
            targetCity: data.targetCity || data.city || '',
            characters: data.characters || [],
            startNodeId: getValidStartNodeId(normalizedNodes, data.startNodeId),
            nodes: normalizedNodes
        };
    };

    const openEdit = async (id) => {
        try {
            clearFeedback();
            setImportError('');
            setImportSuccess('');
            setCanvasOffset({ x: 0, y: 0 });
            setZoom(1);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/game-scenarios/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const normalizedScenario = normalizeScenario(res.data);
            setEditing(normalizedScenario);
            setSelectedNodeId(normalizedScenario.startNodeId);
            setActiveTab('canvas');
            requestAnimationFrame(() => fitNodesToViewport(normalizedScenario.nodes));
        } catch (err) {
            console.error('openEdit:', err);
        }
    };

    const handleSave = async () => {
        if (!editing.title.trim()) { alert('Введіть назву'); return; }
        if (!editing.nodes.length) { alert('Додайте хоча б один вузол'); return; }
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const startNodeId = getValidStartNodeId(editing.nodes, editing.startNodeId);

            const payload = {
                title: editing.title.trim(),
                description: (editing.description || '').trim(),
                startNodeId,
                characters: (editing.characters || []).map(c => ({
                    charId: c.charId,
                    name: c.name,
                    avatar: c.avatar,
                    color: c.color,
                    description: c.description
                })),
                nodes: editing.nodes.map(n => ({
                    nodeId: n.nodeId,
                    text: n.text,
                    speakerId: n.speakerId,
                    x: n.x,
                    y: n.y,
                    choices: n.choices.map(c => ({
                        choiceId: c.choiceId || genChoiceId(),
                        text: c.text,
                        nextNodeId: c.nextNodeId || null,
                        isWin: c.isWin,
                        result: c.result
                    }))
                })),
                targetCity: user?.role === 'superadmin' ? (editing.targetCity || '').trim() : undefined
            };
            if (editing._id) {
                await axios.put(`${API_URL}/game-scenarios/${editing._id}`, payload, config);
                setEditing(prev => ({ ...prev, startNodeId }));
            } else {
                const res = await axios.post(`${API_URL}/game-scenarios`, payload, config);
                setEditing(prev => ({ ...prev, _id: res.data._id, startNodeId }));
            }
            await fetchScenarios();
            setLinkingFrom(null);
            setCharForm(null);
            setCopyStatus('SAVED_OK');
            setTimeout(() => setCopyStatus(null), 2000);
            showFeedback('Сценарій збережено', 'success', 2000);
        } catch (err) {
            console.error('handleSave:', err);
            alert('Помилка збереження');
        } finally {
            setSaving(false);
        }
    };

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const scaleFactor = 0.1;
        const newZoom = e.deltaY > 0 ? Math.max(0.2, zoom - scaleFactor) : Math.min(2, zoom + scaleFactor);
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const zoomRatio = newZoom / zoom;
        setCanvasOffset(prev => ({
            x: mouseX - (mouseX - prev.x) * zoomRatio,
            y: mouseY - (mouseY - prev.y) * zoomRatio
        }));
        setZoom(newZoom);
    }, [zoom]);

    // Прикріплюємо wheel як non-passive (після визначення handleWheel), щоб дозволити preventDefault
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.addEventListener('wheel', handleWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    const handleMouseDown = (e) => {
        if (linkingFrom) {
            setLinkingFrom(null);
            return;
        }
        if (e.target === canvasRef.current || e.target.classList.contains('n8n-canvas-content') || e.target.classList.contains('n8n-grid-bg')) {
            setIsDraggingCanvas(true);
            setDragStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
        }
    };

    const handleMouseMove = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const curMouseX = (e.clientX - rect.left - canvasOffset.x) / zoom;
        const curMouseY = (e.clientY - rect.top - canvasOffset.y) / zoom;

        if (isDraggingCanvas) {
            setCanvasOffset({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        } else if (isDraggingNode && draggedNodeId) {
            const dx = (e.clientX - dragStart.x) / zoom;
            const dy = (e.clientY - dragStart.y) / zoom;
            setEditing(prev => ({
                ...prev,
                nodes: prev.nodes.map(n =>
                    n.nodeId === draggedNodeId
                        ? { ...n, x: n.x + dx, y: n.y + dy }
                        : n
                )
            }));
            setDragStart({ x: e.clientX, y: e.clientY });
        }

        if (linkingFrom) {
            setMousePos({ x: curMouseX, y: curMouseY });
        }
    };

    const handleMouseUp = () => {
        setIsDraggingCanvas(false);
        setIsDraggingNode(false);
        setDraggedNodeId(null);
    };

    const fitNodesToViewport = useCallback((nodesToFit = []) => {
        const canvas = canvasRef.current;
        const bounds = getNodesBounds(nodesToFit);
        if (!canvas || !bounds) {
            return;
        }

        const horizontalPadding = 120;
        const verticalPadding = 120;
        const availableWidth = Math.max(canvas.clientWidth - horizontalPadding, 240);
        const availableHeight = Math.max(canvas.clientHeight - verticalPadding, 240);
        const nextZoom = Math.min(
            1.15,
            Math.max(0.2, Math.min(availableWidth / bounds.width, availableHeight / bounds.height))
        );

        setZoom(nextZoom);
        setCanvasOffset({
            x: (canvas.clientWidth - bounds.width * nextZoom) / 2 - bounds.minX * nextZoom,
            y: (canvas.clientHeight - bounds.height * nextZoom) / 2 - bounds.minY * nextZoom
        });
    }, []);

    const handleAutoLayout = useCallback(() => {
        if (!editing?.nodes?.length) {
            return;
        }

        const laidOutNodes = autoLayoutNodes(editing.nodes, editing.startNodeId);
        setEditing((prev) => ({
            ...prev,
            nodes: laidOutNodes
        }));
        setSelectedNodeId((prev) => getValidStartNodeId(laidOutNodes, prev || editing.startNodeId));
        showFeedback('Вузли автоматично розкладено', 'success', 2200);
        requestAnimationFrame(() => fitNodesToViewport(laidOutNodes));
    }, [editing, fitNodesToViewport, showFeedback]);

    const handleNodeMouseDown = (e, nodeId) => {
        e.stopPropagation();
        if (linkingFrom) {
            const { nodeId: sourceId, choiceId } = linkingFrom;
            if (sourceId === nodeId) return;
            setEditing(prev => ({
                ...prev,
                nodes: prev.nodes.map(n =>
                    n.nodeId === sourceId
                        ? { ...n, choices: n.choices.map(c => c.choiceId === choiceId ? { ...c, nextNodeId: nodeId } : c) }
                        : n
                )
            }));
            setLinkingFrom(null);
            return;
        }
        setIsDraggingNode(true);
        setDraggedNodeId(nodeId);
        setSelectedNodeId(nodeId);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const addNode = () => {
        const id = genNodeId();
        const centerX = (-canvasOffset.x + (canvasRef.current?.clientWidth || 800) / 2) / zoom;
        const centerY = (-canvasOffset.y + (canvasRef.current?.clientHeight || 600) / 2) / zoom;
        setEditing(prev => ({
            ...prev,
            nodes: [...prev.nodes, {
                nodeId: id,
                text: 'Нова сцена\nОпишіть ситуацію...',
                speakerId: null,
                choices: [{ choiceId: genChoiceId(), text: 'Дія', nextNodeId: null, isWin: false, result: '' }],
                x: centerX - 120,
                y: centerY - 40
            }]
        }));
        setSelectedNodeId(id);
    };

    const duplicateNode = (nodeId) => {
        if (!editing) {
            return;
        }

        const sourceNode = editing.nodes.find((node) => node.nodeId === nodeId);
        if (!sourceNode) {
            return;
        }

        const duplicatedNodeId = genNodeId();
        const duplicatedNode = {
            ...sourceNode,
            nodeId: duplicatedNodeId,
            x: (Number(sourceNode.x) || 0) + 80,
            y: (Number(sourceNode.y) || 0) + 80,
            choices: (sourceNode.choices || []).map((choice) => ({
                ...choice,
                choiceId: genChoiceId()
            }))
        };

        setEditing((prev) => ({
            ...prev,
            nodes: [...prev.nodes, duplicatedNode]
        }));
        setSelectedNodeId(duplicatedNodeId);
        showFeedback('Вузол продубльовано', 'success', 1800);
    };

    const addChoice = () => {
        if (!selectedNodeId) return;
        setEditing(prev => ({
            ...prev,
            nodes: prev.nodes.map(n =>
                n.nodeId === selectedNodeId
                    ? { ...n, choices: [...n.choices, { choiceId: genChoiceId(), text: 'Новий вибір', nextNodeId: null, isWin: false, result: '' }] }
                    : n
            )
        }));
    };

    const updateSelectedNode = (field, value) => {
        setEditing(prev => ({
            ...prev,
            nodes: prev.nodes.map(n =>
                n.nodeId === selectedNodeId ? { ...n, [field]: value } : n
            )
        }));
    };

    const updateChoice = (choiceId, field, value) => {
        setEditing(prev => ({
            ...prev,
            nodes: prev.nodes.map(n =>
                n.nodeId === selectedNodeId
                    ? { ...n, choices: n.choices.map(c => c.choiceId === choiceId ? { ...c, [field]: value } : c) }
                    : n
            )
        }));
    };

    const deleteChoice = (choiceId) => {
        setEditing(prev => ({
            ...prev,
            nodes: prev.nodes.map(n =>
                n.nodeId === selectedNodeId
                    ? { ...n, choices: n.choices.filter(c => c.choiceId !== choiceId) }
                    : n
            )
        }));
    };

    const deleteNode = (nodeId) => {
        if (!editing || editing.nodes.length <= 1) {
            alert('Потрібен хоча б один вузол');
            return;
        }

        const remainingNodes = editing.nodes
            .filter(n => n.nodeId !== nodeId)
            .map(n => ({
                ...n,
                choices: n.choices.map(c => c.nextNodeId === nodeId ? { ...c, nextNodeId: null } : c)
            }));
        const nextStartNodeId = editing.startNodeId === nodeId
            ? getValidStartNodeId(remainingNodes, '')
            : getValidStartNodeId(remainingNodes, editing.startNodeId);
        const nextSelectedNodeId = selectedNodeId === nodeId
            ? (nextStartNodeId || remainingNodes[0]?.nodeId || null)
            : selectedNodeId;

        setEditing(prev => ({
            ...prev,
            startNodeId: nextStartNodeId,
            nodes: remainingNodes
        }));
        setSelectedNodeId(nextSelectedNodeId);
        setLinkingFrom(prev => (prev?.nodeId === nodeId ? null : prev));
    };

    const setAsStart = (nodeId) => {
        setEditing(prev => ({ ...prev, startNodeId: nodeId }));
    };

    const saveChar = () => {
        if (!charForm.name.trim()) { alert('Введіть ім\'я персонажа'); return; }
        setEditing(prev => {
            if (charForm.charId) {
                return {
                    ...prev,
                    characters: prev.characters.map(c => c.charId === charForm.charId ? { ...charForm } : c)
                };
            }
            return {
                ...prev,
                characters: [...prev.characters, { ...charForm, charId: genCharId() }]
            };
        });
        setCharForm(null);
    };

    const deleteChar = (charId) => {
        setEditing(prev => ({
            ...prev,
            characters: prev.characters.filter(c => c.charId !== charId),
            nodes: prev.nodes.map(n => n.speakerId === charId ? { ...n, speakerId: null } : n)
        }));
    };

    // ── Export / Import functions ─────────────────────────────────────────────

    const handleExport = () => {
        if (!editing) return;
        downloadExportFile(editing);
    };

    const handleExportScenario = async (scenarioId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/game-scenarios/${scenarioId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const scenario = normalizeScenario(res.data);
            downloadExportFile(scenario);
        } catch (err) {
            console.error('Export error:', err);
            alert('Помилка експорту: ' + err.message);
        }
    };

    const downloadExportFile = (scenario) => {
        const exportData = {
            $schema: 'serviq-scenario-template-v1',
            title: scenario.title,
            description: scenario.description || '',
            targetCity: scenario.targetCity || '',
            characters: (scenario.characters || []).map(c => ({
                name: c.name,
                avatar: c.avatar,
                color: c.color,
                description: c.description || ''
            })),
            nodes: scenario.nodes.map(n => ({
                text: n.text,
                speaker: n.speakerId ? (scenario.characters.find(c => c.charId === n.speakerId)?.name || '') : '',
                choices: n.choices.map(c => ({
                    text: c.text,
                    nextNode: c.nextNodeId ? (scenario.nodes.find(node => node.nodeId === c.nextNodeId)?.text || '') : null,
                    isWin: c.isWin,
                    result: c.result || ''
                })),
                x: n.x,
                y: n.y
            })),
            startNode: scenario.nodes.find(n => n.nodeId === scenario.startNodeId)?.text || ''
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${scenario.title.replace(/[^a-z0-9а-яіїєґ]/gi, '_')}_template.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        } else {
            setImportError('Помилка: не вдалося відкрити вікно вибору файлу.');
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportError('');
        setImportSuccess('');

        const fileName = file.name.toLowerCase();

        console.log('Importing file:', file.name, file.size, 'bytes');

        // Обробка Excel файлів
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    console.log('File loaded, processing...');
                    const data = new Uint8Array(event.target.result);
                    const workbook = read(data, { type: 'array' });

                    console.log('Workbook sheets:', workbook.SheetNames);

                    // Отримуємо перший аркуш
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];

                    // Конвертуємо в JSON
                    const jsonData = utils.sheet_to_json(worksheet, { header: 1 });
                    console.log('Parsed rows:', jsonData.length);
                    parseExcelData(jsonData);
                } catch (err) {
                    console.error('Excel import error:', err);
                    setImportError('Помилка читання Excel: ' + err.message + '\nПереконайтеся, що файл має правильний формат.');
                }
            };
            reader.onerror = () => {
                console.error('FileReader error');
                setImportError('Помилка читання файлу.');
            };
            reader.readAsArrayBuffer(file);
        } else {
            // Обробка JSON файлів
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    validateImportData(data);
                } catch (err) {
                    console.error('Import error:', err);
                    setImportError('Помилка читання JSON: ' + err.message + '\nПереконайтеся, що файл має правильний формат.');
                }
            };
            reader.onerror = () => {
                setImportError('Помилка читання файлу. Перевірте чи файл існує та доступний.');
            };
            reader.readAsText(file);
        }
        e.target.value = '';
    };

    const parseExcelData = (rows) => {
        if (rows.length < 2) {
            setImportError('Файл занадто короткий. Має бути хоча б 2 рядки.');
            return;
        }

        try {
            // Перевіряємо тип формату - квіз чи стандартний сценарій
            const headers = rows[0].map(h => String(h || '').trim());
            const headersLower = headers.map(h => h.toLowerCase().trim());
            
            console.log('Excel headers:', headers);
            console.log('Excel headers (lower):', headersLower);

            // Визначаємо тип формату
            const isQuizFormat = headers.length === 1 && 
                (headersLower[0].includes('ситуація') || 
                 headersLower[0].includes('тест') || 
                 headersLower[0].includes('питання'));
            
            console.log('Is quiz format:', isQuizFormat);

            if (isQuizFormat) {
                parseQuizFormat(rows, headers);
            } else {
                parseScenarioFormat(rows, headers, headersLower);
            }
        } catch (err) {
            console.error('Parse error:', err);
            setImportError('Помилка обробки файлу: ' + err.message);
        }
    };

    // Парсинг формату квізу (Тестова ситуація.xlsx) — 4 колонки, 3 рівні дерева рішень
    const parseQuizFormat = (rows, headers) => {
        console.log('Parsing quiz format (multi-level tree)...');

        // Нормалізуємо кириличні літери А/В/С/Д до латинських A/B/C/D
        const normLetter = (ch) => {
            const map = { 'А': 'A', 'В': 'B', 'С': 'C', 'Д': 'D', 'а': 'A', 'в': 'B', 'с': 'C', 'д': 'D' };
            return map[ch] || ch.toUpperCase();
        };

        // Парсинг тексту вибору: витягуємо текст і відсоток
        const parseChoiceCell = (raw) => {
            const content = raw.trim();
            const pctMatch = content.match(/(\d{1,3})%/);
            if (!pctMatch) return { text: content, percent: 0 };
            const pctStr = pctMatch[0]; // "100%"
            const lastIdx = content.lastIndexOf(pctStr);
            const text = content.substring(0, lastIdx).trim();
            return { text, percent: parseInt(pctMatch[1]) };
        };

        const situationText = headers[0];
        // l1Map: 'A' → { text, percent }
        // l2Map: 'A-A' → { text, percent, l3Choices: [{letter, text, percent, result}] }
        const l1Map = new Map();
        const l2Map = new Map();
        let currentL1 = null;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const col0 = row[0] != null ? String(row[0]).trim() : '';
            const col1 = row[1] != null ? String(row[1]).trim() : '';
            const col2 = row[2] != null ? String(row[2]).trim() : '';
            const col3 = row[3] != null ? String(row[3]).trim() : '';

            // Рівень 1: з колонки 0
            if (col0) {
                const m = col0.match(/^([A-DА-ДС])\)\s*(.+)/s);
                if (m) {
                    currentL1 = normLetter(m[1]);
                    const { text, percent } = parseChoiceCell(m[2]);
                    if (!l1Map.has(currentL1)) l1Map.set(currentL1, { text, percent });
                }
            }

            if (!currentL1) continue;

            // Рівень 2: з колонки 1 (може починатись з \n)
            if (!col1) continue;
            const l2Match = col1.match(/^([A-DА-ДС])\)\s*(.+)/s);
            if (!l2Match) continue; // рядок-підзаголовок — пропускаємо

            const l2Letter = normLetter(l2Match[1]);
            const { text: l2Text, percent: l2Pct } = parseChoiceCell(l2Match[2]);
            const comboKey = `${currentL1}-${l2Letter}`;

            // Рівень 3: з колонки 2 (кілька варіантів у одній клітинці, розділені \n)
            const l3Choices = [];
            if (col2) {
                for (const line of col2.split('\n')) {
                    const lm = line.trim().match(/^([A-DА-ДС])\)\s*(.+)/);
                    if (!lm) continue;
                    const letter = normLetter(lm[1]);
                    const { text, percent } = parseChoiceCell(lm[2]);
                    l3Choices.push({ letter, text, percent, result: '' });
                }
            }

            // Результати з колонки 3: ключ "ААА - 73% текст..."
            // 3-й символ ключа — буква рівня 3
            if (col3 && l3Choices.length > 0) {
                let curKey = null;
                let curLines = [];
                const assignResult = () => {
                    if (!curKey || curLines.length === 0) return;
                    const l3L = normLetter(curKey[2]);
                    const found = l3Choices.find(c => c.letter === l3L);
                    if (found) found.result = curLines.join(' ').trim();
                };
                for (const line of col3.split('\n')) {
                    const t = line.trim();
                    if (!t || t.startsWith('РЕЗУЛЬТАТИ:')) continue;
                    const rm = t.match(/^([A-DА-ДСa-dа-дс]{3})\s*[-–]\s*(\d{1,3})%\s*(.*)/);
                    if (rm) {
                        assignResult();
                        curKey = rm[1];
                        curLines = [`${rm[2]}% ${rm[3]}`.trim()];
                    } else if (curKey) {
                        curLines.push(t);
                    }
                }
                assignResult();
            }

            l2Map.set(comboKey, { text: l2Text, percent: l2Pct, l3Choices });
        }

        if (l1Map.size === 0) {
            setImportError('Не знайдено варіантів відповіді у файлі. Перевірте формат (очікується 4 колонки).');
            return;
        }

        // Будуємо масив вузлів з посиланнями _nodeRef / _nextNodeRef
        const L1_ORDER = ['A', 'B', 'C', 'D'].filter(l => l1Map.has(l));
        const nodes = [];

        // Відступ між групами L2 (4 вузли × 170px + 80px padding між групами)
        const L2_STEP = 170;
        const L1_GROUP_H = 4 * L2_STEP + 80; // 760px на групу L1

        // Стартовий вузол — ситуація (вертикально по центру всього дерева)
        const treeHeight = L1_ORDER.length * L1_GROUP_H;
        nodes.push({
            _nodeRef: 'situation',
            text: situationText,
            speaker: '',
            x: 50, y: Math.round(treeHeight / 2) - 60,
            choices: L1_ORDER.map(l => ({
                text: l1Map.get(l).text,
                _nextNodeRef: `l1-${l}`,
                isWin: false,
                result: ''
            }))
        });

        // L1 вузли — кожен вирівняний по центру своєї групи L2
        for (let li = 0; li < L1_ORDER.length; li++) {
            const l1 = L1_ORDER[li];
            const L2_ORDER = ['A', 'B', 'C', 'D'].filter(l => l2Map.has(`${l1}-${l}`));
            const groupTopY = li * L1_GROUP_H + 40;
            const groupCenterY = groupTopY + Math.round((L2_ORDER.length * L2_STEP) / 2) - L2_STEP / 2;
            nodes.push({
                _nodeRef: `l1-${l1}`,
                text: l1Map.get(l1).text,
                speaker: '',
                x: 480, y: groupCenterY,
                choices: L2_ORDER.map(l => ({
                    text: l2Map.get(`${l1}-${l}`).text,
                    _nextNodeRef: `l2-${l1}-${l}`,
                    isWin: false,
                    result: ''
                }))
            });
        }

        // L2 вузли — згруповані під своїм L1 вузлом
        let l2Total = 0;
        for (let l1i = 0; l1i < L1_ORDER.length; l1i++) {
            const l1 = L1_ORDER[l1i];
            const L2_ORDER = ['A', 'B', 'C', 'D'].filter(l => l2Map.has(`${l1}-${l}`));
            const groupTopY = l1i * L1_GROUP_H + 40;
            for (let l2i = 0; l2i < L2_ORDER.length; l2i++) {
                const l2 = L2_ORDER[l2i];
                const l2Data = l2Map.get(`${l1}-${l2}`);
                nodes.push({
                    _nodeRef: `l2-${l1}-${l2}`,
                    text: l2Data.text,
                    speaker: '',
                    x: 910, y: groupTopY + l2i * L2_STEP,
                    choices: l2Data.l3Choices.map(l3 => {
                        const isWin = l3.percent >= 80;
                        const icon = l3.percent >= 80 ? '✅' : l3.percent >= 60 ? '⚠️' : '❌';
                        return {
                            text: l3.text,
                            _nextNodeRef: null,
                            isWin,
                            result: l3.result
                                ? `${icon} ${l3.percent}% — ${l3.result}`
                                : `${icon} ${l3.percent}%`
                        };
                    })
                });
                l2Total++;
            }
        }

        const totalNodes = nodes.length;
        console.log(`Quiz parsed: ${totalNodes} nodes (1 situation + ${L1_ORDER.length} L1 + ${l2Total} L2)`);

        const importData = {
            $schema: 'serviq-scenario-template-v1',
            title: situationText.length > 60 ? situationText.substring(0, 60) + '...' : situationText,
            description: 'Квіз-сценарій (3 рівні вибору)',
            targetCity: '',
            characters: [],
            nodes,
            startNode: situationText
        };

        setImportError('');
        openQuizEditor(importData);
    };

    // Відкриття редактора для квіз-формату
    const openQuizEditor = (importData) => {
        console.log('openQuizEditor called with:', importData.nodes?.length, 'nodes');
        try {
            const charMap = {};
            const refMap = {}; // _nodeRef → nodeId
            const newChars = (importData.characters || []).map(c => ({
                charId: genCharId(),
                ...c
            }));
            newChars.forEach(c => { charMap[c.name] = c.charId; });

            const startNodeText = importData.startNode;
            let startNodeId = null;

            // Перший прохід: створюємо вузли та будуємо refMap
            const newNodes = importData.nodes.map((n, i) => {
                const nodeId = genNodeId();
                if (n.text === startNodeText) startNodeId = nodeId;
                if (n._nodeRef) refMap[n._nodeRef] = nodeId;
                return {
                    nodeId,
                    text: n.text,
                    speakerId: n.speaker ? (charMap[n.speaker] || null) : null,
                    choices: (n.choices || []).map(c => ({
                        choiceId: genChoiceId(),
                        text: c.text,
                        nextNodeId: null, // розв'язується у другому проході
                        isWin: c.isWin || false,
                        result: c.result || ''
                    })),
                    x: n.x ?? (100 + (i % 5) * 280),
                    y: n.y ?? (100 + Math.floor(i / 5) * 200)
                };
            });

            // Другий прохід: розв'язуємо nextNodeId через _nextNodeRef
            newNodes.forEach((node, i) => {
                const srcChoices = importData.nodes[i].choices || [];
                node.choices.forEach((choice, j) => {
                    const ref = (srcChoices[j] || {})._nextNodeRef;
                    if (ref && refMap[ref]) choice.nextNodeId = refMap[ref];
                });
            });

            console.log('Created nodes:', newNodes.length, 'startNodeId:', startNodeId, 'refMap keys:', Object.keys(refMap).length);

            if (!startNodeId && newNodes.length > 0) {
                startNodeId = newNodes[0].nodeId;
            }

            const newScenario = normalizeScenario({
                _id: null,
                title: importData.title,
                description: importData.description || '',
                targetCity: importData.targetCity || '',
                startNodeId,
                characters: newChars,
                nodes: newNodes
            });

            setEditing(newScenario);
            setSelectedNodeId(newScenario.startNodeId);
            setActiveTab('canvas');
            setLinkingFrom(null);
            setCharForm(null);
            setImportSuccess(`✅ Імпортовано ${newNodes.length} вузлів! Відкрито редактор.`);
            setTimeout(() => setImportSuccess(''), 5000);
        } catch (err) {
            console.error('openQuizEditor error:', err);
            setImportError('Помилка відкриття редактора: ' + err.message);
        }
    };

    // Парсинг стандартного формату сценаріїв
    const parseScenarioFormat = (rows, headers, headersLower) => {
        // Функція для пошуку індексу колонки за кількома варіантами назви
        const findColumnIndex = (variants) => {
            for (let i = 0; i < headersLower.length; i++) {
                const header = headersLower[i];
                for (const variant of variants) {
                    const variantNorm = variant.toLowerCase().trim();
                    if (header === variantNorm ||
                        header.includes(variantNorm) ||
                        (variantNorm.length >= 3 && header.includes(variantNorm))) {
                        return i;
                    }
                }
            }
            return -1;
        };

        // Індекси колонок - багато варіантів назв
        const idx = {
            nodeText: findColumnIndex(['текст сцени', 'сцена', 'текст', 'text', 'scene', 'опис', 'опис сцени', 'ситуація', 'питання']),
            speaker: findColumnIndex(['персонаж', 'хто', 'speaker', 'actor', 'герой', 'діюча особа', 'роль']),
            choiceText: findColumnIndex(['вибір', 'дія', 'choice', 'action', 'варіант', 'відповідь', 'варіант відповіді', 'що робити']),
            nextNode: findColumnIndex(['наступна сцена', 'куди', 'next', 'наступний', 'продовження', 'перехід', 'до']),
            isWin: findColumnIndex(['перемога', 'win', 'iswin', 'успіх', 'результат гри', 'фінал']),
            result: findColumnIndex(['результат', 'result', 'наслідок', 'фінал', 'підсумок', 'висновок'])
        };

        console.log('Column indices:', idx);

        if (idx.nodeText === -1) {
            const availableColumns = headers.map((h, i) => `${i + 1}. "${h}"`).join('\n');
            setImportError('Не знайдено колонку "Текст сцени".\n\nДоступні колонки:\n' + availableColumns + '\n\nОчікувані назви колонок (будь-яка з цих):\n- Текст сцени\n- сцена\n- текст\n- text\n- scene\n- опис\n- опис сцени\n- ситуація\n- питання\n\nПерейменуйте колонку або додайте колонку з назвою "Текст сцени".\n\n💡 Натисніть "📋 Шаблон" щоб завантажити готовий Excel-шаблон з правильним форматом.');
            return;
        }

        const nodesMap = new Map();
        const characters = [];
        const charMap = new Map();

        // Збираємо унікальні вузли та персонажів
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row[idx.nodeText]) continue;

            const nodeText = String(row[idx.nodeText]).trim();
            const speaker = row[idx.speaker] ? String(row[idx.speaker]).trim() : '';

            if (!nodesMap.has(nodeText)) {
                nodesMap.set(nodeText, {
                    text: nodeText,
                    speaker: speaker,
                    choices: []
                });

                if (speaker && !charMap.has(speaker)) {
                    const charId = genCharId();
                    charMap.set(speaker, charId);
                    characters.push({
                        charId,
                        name: speaker,
                        avatar: '🧑',
                        color: COLOR_PRESETS[characters.length % COLOR_PRESETS.length],
                        description: ''
                    });
                }
            }

            // Додаємо вибір якщо є
            if (idx.choiceText !== -1 && row[idx.choiceText]) {
                const choiceText = String(row[idx.choiceText]).trim();
                const nextNode = idx.nextNode !== -1 && row[idx.nextNode] ? String(row[idx.nextNode]).trim() : null;
                const isWin = idx.isWin !== -1 && (row[idx.isWin] === true || row[idx.isWin] === 'true' || row[idx.isWin] === 1);
                const result = idx.result !== -1 && row[idx.result] ? String(row[idx.result]).trim() : '';

                nodesMap.get(nodeText).choices.push({
                    text: choiceText,
                    nextNode: nextNode || null,
                    isWin,
                    result
                });
            }
        }

        // Створюємо структуру сценарію
        const nodesArray = Array.from(nodesMap.values());
        const startNode = nodesArray.length > 0 ? nodesArray[0].text : '';

        const importData = {
            $schema: 'serviq-scenario-template-v1',
            title: 'Імпорт з Excel',
            description: 'Імпортовано з Excel файлу',
            targetCity: '',
            characters,
            nodes: nodesArray.map(n => ({
                text: n.text,
                speaker: n.speaker,
                choices: n.choices,
                x: 100 + (nodesArray.indexOf(n) % 5) * 280,
                y: 100 + Math.floor(nodesArray.indexOf(n) / 5) * 200
            })),
            startNode
        };

        validateImportData(importData);
    };

    const validateImportData = (data) => {
        const errors = [];
        if (!data.title || typeof data.title !== 'string') {
            errors.push('Відсутня назва сценарію (title)');
        }
        if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
            errors.push('Відсутні вузли (nodes)');
        }
        if (!data.startNode || typeof data.startNode !== 'string') {
            errors.push('Відсутній стартовий вузол (startNode)');
        }
        if (errors.length > 0) {
            setImportError('Помилки валідації:\n' + errors.join('\n'));
            return;
        }
        setImportData(data);
        setShowImportModal(true);
    };

    const confirmImport = () => {
        console.log('confirmImport called, importData:', importData);
        if (!importData) {
            console.error('No importData!');
            return;
        }
        try {
            const charMap = {};
            const nodeMap = {};
            const newChars = (importData.characters || []).map(c => ({
                charId: genCharId(),
                ...c
            }));
            newChars.forEach(c => { charMap[c.name] = c.charId; });

            const startNodeText = importData.startNode;
            let startNodeId = null;

            const newNodes = importData.nodes.map((n, i) => {
                const nodeId = genNodeId();
                if (n.text === startNodeText) {
                    startNodeId = nodeId;
                }
                nodeMap[n.text] = nodeId;
                return {
                    nodeId,
                    text: n.text,
                    speakerId: n.speaker ? (charMap[n.speaker] || null) : null,
                    choices: (n.choices || []).map(c => ({
                        choiceId: genChoiceId(),
                        text: c.text,
                        nextNodeId: null,
                        isWin: c.isWin || false,
                        result: c.result || ''
                    })),
                    x: n.x ?? (100 + (i % 5) * 280),
                    y: n.y ?? (100 + Math.floor(i / 5) * 200)
                };
            });

            newNodes.forEach(node => {
                const originalNode = importData.nodes.find(n => n.text === node.text);
                if (originalNode?.choices) {
                    originalNode.choices.forEach((c, i) => {
                        if (c.nextNode && nodeMap[c.nextNode]) {
                            node.choices[i].nextNodeId = nodeMap[c.nextNode];
                        }
                    });
                }
            });

            if (!startNodeId && newNodes.length > 0) {
                startNodeId = newNodes[0].nodeId;
            }

            const importedScenario = normalizeScenario({
                _id: null,
                title: importData.title,
                description: importData.description || '',
                targetCity: importData.targetCity || '',
                startNodeId,
                characters: newChars,
                nodes: newNodes
            });
            setEditing(importedScenario);
            setSelectedNodeId(importedScenario.startNodeId);
            setActiveTab('canvas');
            setLinkingFrom(null);
            setCharForm(null);
            setShowImportModal(false);
            setImportData(null);
            setImportSuccess('Сценарій успішно імпортовано!');
            setTimeout(() => setImportSuccess(''), 3000);
        } catch (err) {
            setImportError('Помилка імпорту: ' + err.message);
        }
    };

    // Node geometry constants (must match CSS):
    //   header: 44px, body-padding: 10+10=20px, text-block: ~52px
    //   choices-border: 1px, choices-top-pad: 4px, each row: 30px
    //   choice-center from top = 44+10+52+10+1+4+15 + i*30 = 136 + i*30
    const NODE_W       = 260;
    const CHOICE_BASE_Y = 136;
    const CHOICE_STEP   = 30;
    const INPUT_PORT_Y  = 22; // center of header

    const renderConnections = () => {
        if (!editing) return null;
        const connections = [];
        editing.nodes.forEach(node => {
            node.choices.forEach((choice, i) => {
                if (!choice.nextNodeId) return;
                const target = editing.nodes.find(n => n.nodeId === choice.nextNodeId);
                if (!target) return;

                const startX = node.x + NODE_W + 5;
                const startY = node.y + CHOICE_BASE_Y + i * CHOICE_STEP;
                const endX   = target.x - 5;
                const endY   = target.y + INPUT_PORT_Y;

                const cpOff = Math.max(60, Math.abs(endX - startX) * 0.45);
                const path  = `M ${startX} ${startY} C ${startX + cpOff} ${startY}, ${endX - cpOff} ${endY}, ${endX} ${endY}`;

                const connClass = choice.isWin
                    ? 'n8n-connection n8n-connection-win'
                    : (choice.result ? 'n8n-connection n8n-connection-lose' : 'n8n-connection n8n-connection-normal');
                const marker = choice.isWin ? 'url(#arrow-win)' : (choice.result ? 'url(#arrow-lose)' : 'url(#arrow)');

                connections.push(
                    <g key={`${node.nodeId}-${choice.choiceId || i}`}>
                        <path d={path} className="n8n-connection-shadow" />
                        <path d={path} className={connClass} markerEnd={marker} />
                    </g>
                );
            });
        });

        if (linkingFrom) {
            const node = editing.nodes.find(n => n.nodeId === linkingFrom.nodeId);
            if (node) {
                const i = node.choices.findIndex(c => c.choiceId === linkingFrom.choiceId);
                const startX = node.x + NODE_W + 5;
                const startY = node.y + CHOICE_BASE_Y + i * CHOICE_STEP;
                const cpOff  = Math.max(60, Math.abs(mousePos.x - startX) * 0.45);
                const path   = `M ${startX} ${startY} C ${startX + cpOff} ${startY}, ${mousePos.x - cpOff} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`;
                connections.push(<path key="ghost" d={path} className="n8n-connection-ghost" markerEnd="url(#arrow)" />);
            }
        }

        return (
            <svg className="n8n-connections">
                <defs>
                    <marker id="arrow"      markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L7,3 z" fill="#475569" />
                    </marker>
                    <marker id="arrow-win"  markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L7,3 z" fill="#4ade80" />
                    </marker>
                    <marker id="arrow-lose" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L7,3 z" fill="#f87171" />
                    </marker>
                </defs>
                {connections}
            </svg>
        );
    };

    const renderMinimap = () => {
        if (!editing || !minimapRef.current) return null;
        const scale = 0.15;
        const nodes = editing.nodes.map(n => (
            <rect
                key={n.nodeId}
                x={n.x * scale}
                y={n.y * scale}
                width={24}
                height={8}
                fill={n.nodeId === editing.startNodeId ? '#4caf50' : '#ff6d5a'}
                rx={2}
            />
        ));
        return (
            <svg className="n8n-minimap" ref={minimapRef}>
                {nodes}
            </svg>
        );
    };

    const renderFeedbackBanners = () => (
        <>
            {importSuccess && (
                <div className="n8n-alert n8n-alert-success">{importSuccess}</div>
            )}
            {importError && (
                <div className="n8n-alert n8n-alert-error">{importError}</div>
            )}
        </>
    );

    if (!editing) {
        const filteredScenarios = scenarios.filter(s => {
            const scenarioCity = s.targetCity || s.city || '';
            return !filterCity || scenarioCity === filterCity;
        });
        return (
            <div className="n8n-builder-container">
                <div className="n8n-header">
                    <h2>🗺️ Візуальний конструктор сценаріїв</h2>
                    <div className="n8n-header-actions">
                        {user?.role === 'superadmin' && (
                            <select
                                className="n8n-filter"
                                value={filterCity}
                                onChange={e => setFilterCity(e.target.value)}
                            >
                                <option value="">Всі міста</option>
                                {cities.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                            </select>
                        )}
                        <button 
                            className="n8n-btn n8n-btn-secondary" 
                            onClick={() => window.open(`${API_URL}/templates/scenario-template/excel`, '_blank')} 
                            title="Завантажити шаблон Excel"
                        >
                            📋 Шаблон
                        </button>
                        <button className="n8n-btn n8n-btn-secondary" onClick={handleImportClick} title="Імпорт JSON або Excel">📥 Імпорт</button>
                        <button className="n8n-btn n8n-btn-primary" onClick={openNew}>+ Новий сценарій</button>
                    </div>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".json,.xlsx,.xls"
                    onChange={handleFileChange}
                />
                {renderFeedbackBanners()}
                <div className="n8n-scenarios-grid">
                    {filteredScenarios.map(s => (
                        <div key={s._id} className="n8n-scenario-card">
                            <div className="n8n-scenario-header">
                                <h3>{s.title}</h3>
                                {s.targetCity && <span className="n8n-city-badge">📍 {s.targetCity}</span>}
                            </div>
                            <button className="n8n-canvas-btn" onClick={handleAutoLayout} title="Автоматично розкласти вузли для зручного редагування">Auto</button>
                            <button className="n8n-canvas-btn" onClick={() => fitNodesToViewport(editing.nodes)} title="Вмістити всі вузли у видиму область">Fit</button>
                            <p className="n8n-scenario-desc">{s.description || 'Без опису'}</p>
                            <div className="n8n-scenario-footer">
                                <span className="n8n-date">{new Date(s.createdAt).toLocaleDateString('uk-UA')}</span>
                                <div className="n8n-actions">
                                    <button className="n8n-icon-btn" onClick={() => handleExportScenario(s._id)} title="Експортувати шаблон">📤</button>
                                    <button className="n8n-icon-btn" onClick={() => handleCopyLink(s._id)} title="Копіювати посилання">
                                        {copyStatus === s._id ? '✓' : '🔗'}
                                    </button>
                                    <button className="n8n-icon-btn" onClick={() => openEdit(s._id)} title="Редагувати">✏️</button>
                                    <button className="n8n-icon-btn n8n-icon-danger" onClick={() => {
                                        setConfirmModal({ isOpen: true, idToDelete: s._id });
                                    }} title="Видалити">🗑️</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {filteredScenarios.length === 0 && (
                    <div className="n8n-empty-state">
                        <p>{filterCity ? 'Для вибраного міста сценаріїв поки немає.' : 'Сценарії ще не створені.'}</p>
                        <button className="n8n-btn n8n-btn-primary" onClick={openNew}>+ Створити сценарій</button>
                    </div>
                )}
                <ConfirmModal
                    isOpen={confirmModal.isOpen}
                    title="Видалення сценарію"
                    message="Ви впевнені, що хочете видалити цей ігровий сценарій? Цю дію неможливо скасувати."
                    confirmText="Видалити"
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setConfirmModal({ isOpen: false, idToDelete: null })}
                />
            </div>
        );
    }

    const selectedNode = editing.nodes.find(n => n.nodeId === selectedNodeId);
    const scenarioDiagnostics = createScenarioDiagnostics(editing.nodes, editing.startNodeId);
    const hasScenarioWarnings = scenarioDiagnostics.length > 0;

    return (
        <div className="n8n-full-editor">
            <header className="n8n-editor-header">
                <div className="n8n-editor-title-row">
                    <input
                        className="n8n-title-input"
                        value={editing.title}
                        onChange={e => setEditing({ ...editing, title: e.target.value })}
                        placeholder="Назва сценарію"
                    />
                    {user?.role === 'superadmin' && (
                        <select
                            className="n8n-city-select"
                            value={editing.targetCity || ''}
                            onChange={e => setEditing({ ...editing, targetCity: e.target.value })}
                        >
                            <option value="">Всі міста</option>
                            {cities.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                        </select>
                    )}
                    <div className="n8n-editor-tabs">
                        <button className={`n8n-tab ${activeTab === 'canvas' ? 'active' : ''}`} onClick={() => setActiveTab('canvas')}>🗺️ Канвас</button>
                        <button className={`n8n-tab ${activeTab === 'characters' ? 'active' : ''}`} onClick={() => { setActiveTab('characters'); setCharForm(null); }}>🧑 Персонажі ({editing.characters.length})</button>
                    </div>
                </div>
                <div className="n8n-editor-actions">
                    {editing._id && (
                        <button className="n8n-btn n8n-btn-secondary" onClick={() => handleCopyLink(editing._id)}>
                            {copyStatus === editing._id ? '✓' : '🔗'}
                        </button>
                    )}
                    <button className="n8n-btn n8n-btn-secondary" onClick={handleExport} title="Експортувати шаблон">📤</button>
                    <button className="n8n-btn n8n-btn-secondary" onClick={() => { setEditing(null); setLinkingFrom(null); setCharForm(null); }}>✕</button>
                    <button className="n8n-btn n8n-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? '...' : copyStatus === 'SAVED_OK' ? '✓' : '💾'}
                    </button>
                </div>
            </header>

            <div className="n8n-editor-feedback">
                {renderFeedbackBanners()}
            </div>

            <div className="n8n-editor-hints">
                <span>Підказка: колесо мишки змінює масштаб канваса.</span>
                <span>Авто розкладає вузли по рівнях, а Fit вміщує всю схему в екран.</span>
                <div className="n8n-editor-hint-actions">
                    <button className="n8n-btn n8n-btn-secondary n8n-btn-small" onClick={handleAutoLayout} title="Автоматично розкласти вузли для зручного редагування">Auto</button>
                    <button className="n8n-btn n8n-btn-secondary n8n-btn-small" onClick={() => fitNodesToViewport(editing.nodes)} title="Вмістити всі вузли у видиму область">Fit</button>
                </div>
            </div>

            {activeTab === 'canvas' ? (
                <div className="n8n-canvas-wrapper">
                    <div
                        className="n8n-canvas"
                        ref={canvasRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <div
                            className="n8n-canvas-content"
                            style={{
                                transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${zoom})`,
                                transformOrigin: '0 0'
                            }}
                        >
                            {renderConnections()}
                            {editing.nodes.map(node => {
                                const speaker   = node.speakerId ? editing.characters.find(c => c.charId === node.speakerId) : null;
                                const isSelected = selectedNodeId === node.nodeId;
                                const isStart    = editing.startNodeId === node.nodeId;

                                const iconBoxBg = isStart
                                    ? 'rgba(74,222,128,0.15)'
                                    : speaker?.color
                                        ? speaker.color + '26'
                                        : 'rgba(71,85,105,0.4)';
                                const iconBoxColor = isStart ? '#4ade80' : (speaker?.color || '#94a3b8');

                                return (
                                    <div
                                        key={node.nodeId}
                                        className={`n8n-node ${isSelected ? 'selected' : ''} ${isStart ? 'is-start' : ''} ${linkingFrom ? 'is-link-target' : ''}`}
                                        style={{ left: node.x, top: node.y }}
                                        onMouseDown={(e) => handleNodeMouseDown(e, node.nodeId)}
                                        onMouseEnter={() => setNodeHover(node.nodeId)}
                                        onMouseLeave={() => setNodeHover(null)}
                                    >
                                        {/* Input port */}
                                        <div className="n8n-port-in" />

                                        {/* Header */}
                                        <div className="n8n-node-header">
                                            <div className="n8n-node-icon-box" style={{ background: iconBoxBg, color: iconBoxColor }}>
                                                {isStart ? '🚀' : (speaker?.avatar || '📝')}
                                            </div>
                                            <div className="n8n-node-title">
                                                <span className="n8n-node-name" style={{ color: iconBoxColor }}>
                                                    {isStart ? 'START' : 'SCENE'}
                                                </span>
                                                {speaker && (
                                                    <span className="n8n-node-speaker-name">{speaker.name}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div className="n8n-node-body">
                                            <div className="n8n-node-text">{node.text}</div>
                                        </div>

                                        {/* Choice rows with output ports */}
                                        {node.choices.length > 0 && (
                                            <div className="n8n-node-choices">
                                                {node.choices.map((c, i) => {
                                                    const portClass = [
                                                        'n8n-port-out',
                                                        c.nextNodeId ? 'connected' : '',
                                                        c.isWin ? 'win' : '',
                                                        (c.result && !c.isWin) ? 'lose' : '',
                                                        linkingFrom?.choiceId === c.choiceId ? 'linking' : ''
                                                    ].filter(Boolean).join(' ');
                                                    return (
                                                        <div key={c.choiceId || i} className="n8n-choice-row">
                                                            <span className="n8n-choice-letter">{String.fromCharCode(65 + i)}</span>
                                                            <span className="n8n-choice-text-preview">{c.text}</span>
                                                            <div
                                                                className={portClass}
                                                                title={c.nextNodeId ? 'З\'єднано' : 'Клік → зв\'язати'}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (linkingFrom?.choiceId === c.choiceId) {
                                                                        setLinkingFrom(null);
                                                                    } else {
                                                                        setLinkingFrom({ nodeId: node.nodeId, choiceId: c.choiceId });
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Quick actions on hover */}
                                        {nodeHover === node.nodeId && (
                                            <div className="n8n-node-quick-actions">
                                                <button onClick={(e) => { e.stopPropagation(); setAsStart(node.nodeId); }} title="Початковий">🚀</button>
                                                <button className="qa-delete" onClick={(e) => { e.stopPropagation(); deleteNode(node.nodeId); }} title="Видалити">🗑</button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="n8n-canvas-controls">
                            <div className="n8n-zoom-control">
                                <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}>−</button>
                                <span>{Math.round(zoom * 100)}%</span>
                                <button onClick={() => setZoom(z => Math.min(2, z + 0.1))}>+</button>
                            </div>
                            <button className="n8n-canvas-btn" onClick={addNode}>➕ Вузол</button>
                            <button className="n8n-canvas-btn" onClick={() => { setCanvasOffset({ x: 0, y: 0 }); setZoom(1); }}>🎯 Центр</button>
                        </div>

                        {renderMinimap()}
                    </div>

                    <aside className="n8n-sidebar">
                        <div className="n8n-sidebar-header">
                            <h3>Властивості вузла</h3>
                        </div>
                        <div className="n8n-sidebar-content">
                            <div className={`n8n-health-panel ${hasScenarioWarnings ? 'has-issues' : 'is-clean'}`}>
                                <div className="n8n-health-header">
                                    <span>Перевірка сценарію</span>
                                    <strong>{hasScenarioWarnings ? `${scenarioDiagnostics.length} попер.` : 'OK'}</strong>
                                </div>
                                {hasScenarioWarnings ? (
                                    <ul className="n8n-health-list">
                                        {scenarioDiagnostics.slice(0, 5).map((diagnostic, index) => (
                                            <li key={`${index}-${diagnostic}`}>{diagnostic}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="n8n-health-empty">Грубі проблеми не знайдені. Можна спокійно редагувати далі.</p>
                                )}
                            </div>

                            <div className="n8n-helper-card">
                                <div className="n8n-helper-card-title">Швидкі підказки</div>
                                <div className="n8n-helper-card-text">Колесо мишки масштабує канвас, Auto розкладає вузли, Fit підганяє схему у видиму область.</div>
                            </div>

                            {selectedNode ? (
                                <>
                                    <div className="n8n-form-group">
                                        <label className="n8n-label">Персонаж</label>
                                        <select
                                            className="n8n-select"
                                            value={selectedNode.speakerId || ''}
                                            onChange={e => updateSelectedNode('speakerId', e.target.value || null)}
                                        >
                                            <option value="">🗣️ Диктор</option>
                                            {editing.characters.map(c => (
                                                <option key={c.charId} value={c.charId}>{c.avatar} {c.name}</option>
                                            ))}
                                        </select>
                                        <button className="n8n-btn n8n-btn-small n8n-btn-link" onClick={() => setCharForm({ charId: null, name: '', avatar: '🧑', color: '#ff6d5a', description: '' })}>
                                            + Персонаж
                                        </button>
                                    </div>

                                    <div className="n8n-form-group">
                                        <label className="n8n-label">Текст сцени</label>
                                        <textarea
                                            className="n8n-textarea"
                                            rows={4}
                                            value={selectedNode.text}
                                            onChange={e => updateSelectedNode('text', e.target.value)}
                                        />
                                        <div className="n8n-inline-actions">
                                            <button className="n8n-btn n8n-btn-secondary n8n-btn-small" onClick={() => duplicateNode(selectedNode.nodeId)} title="Створити копію поточного вузла поруч">Дублювати вузол</button>
                                            {editing.startNodeId !== selectedNode.nodeId && (
                                                <button className="n8n-btn n8n-btn-secondary n8n-btn-small" onClick={() => setAsStart(selectedNode.nodeId)} title="Зробити цей вузол стартовим">Зробити стартовим</button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="n8n-form-group">
                                        <div className="n8n-label-row">
                                            <label className="n8n-label">Вибори</label>
                                            <button className="n8n-btn n8n-btn-small" onClick={addChoice}>+ Додати</button>
                                        </div>
                                        {selectedNode.choices.map((choice, i) => (
                                            <div key={choice.choiceId || i} className={`n8n-choice-item ${linkingFrom?.choiceId === choice.choiceId ? 'is-linking' : ''}`}>
                                                <div className="n8n-choice-header">
                                                    <span className="n8n-choice-label">{String.fromCharCode(65 + i)}</span>
                                                    <button className="n8n-btn n8n-btn-icon" onClick={() => deleteChoice(choice.choiceId)}>✕</button>
                                                </div>
                                                <input
                                                    className="n8n-input"
                                                    value={choice.text}
                                                    onChange={e => updateChoice(choice.choiceId, 'text', e.target.value)}
                                                    placeholder="Текст кнопки"
                                                />
                                                <div className="n8n-choice-actions">
                                                    <button
                                                        className={`n8n-btn n8n-btn-small ${linkingFrom?.choiceId === choice.choiceId ? 'n8n-btn-primary' : 'n8n-btn-secondary'}`}
                                                        onClick={() => setLinkingFrom({ nodeId: selectedNode.nodeId, choiceId: choice.choiceId })}
                                                    >
                                                        🔗
                                                    </button>
                                                    <select
                                                        className="n8n-select n8n-select-small"
                                                        value={choice.nextNodeId || ''}
                                                        onChange={e => updateChoice(choice.choiceId, 'nextNodeId', e.target.value || null)}
                                                    >
                                                        <option value="">🔚 Кінець</option>
                                                        {editing.nodes.filter(n => n.nodeId !== selectedNode.nodeId).map(n => (
                                                            <option key={n.nodeId} value={n.nodeId}>→ {n.text.slice(0, 25)}...</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {!choice.nextNodeId && (
                                                    <div className="n8n-choice-result">
                                                        <label className="n8n-checkbox-label">
                                                            <input type="checkbox" checked={choice.isWin} onChange={e => updateChoice(choice.choiceId, 'isWin', e.target.checked)} />
                                                            <span>🏆 Перемога</span>
                                                        </label>
                                                        <textarea
                                                            className="n8n-textarea n8n-textarea-small"
                                                            rows={2}
                                                            value={choice.result || ''}
                                                            onChange={e => updateChoice(choice.choiceId, 'result', e.target.value)}
                                                            placeholder="Результат..."
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="n8n-empty-state">
                                    <p>Оберіть вузол на канвасі</p>
                                    <button className="n8n-btn n8n-btn-primary" onClick={addNode}>+ Додати вузол</button>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            ) : (
                <div className="n8n-characters-tab">
                    <div className="n8n-characters-header">
                        <h2>Персонажі ({editing.characters.length})</h2>
                        <button className="n8n-btn n8n-btn-primary" onClick={() => setCharForm({ charId: null, name: '', avatar: '🧑', color: '#ff6d5a', description: '' })}>
                            + Додати персонажа
                        </button>
                    </div>
                    <div className="n8n-characters-grid">
                        {editing.characters.map(char => (
                            <div key={char.charId} className="n8n-character-card">
                                <div className="n8n-character-avatar" style={{ background: char.color + '22', color: char.color }}>
                                    {char.avatar}
                                </div>
                                <div className="n8n-character-info">
                                    <h3>{char.name}</h3>
                                    <p>{char.description || 'Без опису'}</p>
                                </div>
                                <div className="n8n-character-actions">
                                    <button className="n8n-icon-btn" onClick={() => setCharForm({ ...char })}>✏️</button>
                                    <button className="n8n-icon-btn n8n-icon-danger" onClick={() => deleteChar(char.charId)}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {charForm && (
                <div className="n8n-modal-overlay" onClick={() => setCharForm(null)}>
                    <div className="n8n-modal" onClick={e => e.stopPropagation()}>
                        <h3>{charForm.charId ? 'Редагувати' : 'Новий'} персонаж</h3>
                        <div className="n8n-form-group">
                            <label className="n8n-label">Ім'я</label>
                            <input className="n8n-input" value={charForm.name} onChange={e => setCharForm({ ...charForm, name: e.target.value })} />
                        </div>
                        <div className="n8n-form-group">
                            <label className="n8n-label">Аватар</label>
                            <div className="n8n-avatar-grid">
                                {AVATAR_PRESETS.map(a => (
                                    <button key={a} className={`n8n-avatar-btn ${charForm.avatar === a ? 'selected' : ''}`} onClick={() => setCharForm({ ...charForm, avatar: a })}>
                                        {a}
                                    </button>
                                ))}
                            </div>
                            <input className="n8n-input" placeholder="Свій емодзі" value={charForm.avatar} onChange={e => setCharForm({ ...charForm, avatar: e.target.value })} />
                        </div>
                        <div className="n8n-form-group">
                            <label className="n8n-label">Колір</label>
                            <div className="n8n-color-row">
                                {COLOR_PRESETS.map(c => (
                                    <button key={c} className={`n8n-color-btn ${charForm.color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setCharForm({ ...charForm, color: c })} />
                                ))}
                                <input type="color" value={charForm.color} onChange={e => setCharForm({ ...charForm, color: e.target.value })} />
                            </div>
                        </div>
                        <div className="n8n-form-group">
                            <label className="n8n-label">Опис</label>
                            <textarea className="n8n-textarea" rows={2} value={charForm.description} onChange={e => setCharForm({ ...charForm, description: e.target.value })} />
                        </div>
                        <div className="n8n-modal-actions">
                            <button className="n8n-btn n8n-btn-primary" onClick={saveChar}>Зберегти</button>
                            <button className="n8n-btn n8n-btn-secondary" onClick={() => setCharForm(null)}>Скасувати</button>
                        </div>
                    </div>
                </div>
            )}

            {showImportModal && importData && (
                <div className="n8n-modal-overlay" onClick={() => { setShowImportModal(false); setImportData(null); }}>
                    <div className="n8n-modal n8n-modal-wide" onClick={e => e.stopPropagation()}>
                        <h3>📥 Імпорт сценарію</h3>
                        <div className="n8n-import-preview">
                            <p><strong>Назва:</strong> {importData.title}</p>
                            {importData.description && <p><strong>Опис:</strong> {importData.description}</p>}
                            <p><strong>Вузлів:</strong> {importData.nodes?.length || 0}</p>
                            <p><strong>Персонажів:</strong> {importData.characters?.length || 0}</p>
                            <p><strong>Стартовий вузол:</strong> {importData.startNode}</p>
                        </div>
                        <div className="n8n-modal-actions">
                            <button className="n8n-btn n8n-btn-primary" onClick={confirmImport}>Імпортувати</button>
                            <button className="n8n-btn n8n-btn-secondary" onClick={() => { setShowImportModal(false); setImportData(null); }}>Скасувати</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VisualGameBuilder;

import { useCallback, useMemo, useState } from 'react'
import { Background, Handle, MarkerType, Position, ReactFlow, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { RetailScene } from './components/RetailScene'
import { TrendCharts } from './components/TrendCharts'
import {
  decisionOptions,
  getStoryStage,
  outcomeForDecision,
  storyStages,
  type DecisionId,
  type StageId,
} from './storyData'
import './App.css'

type StageNodeData = { step: string; title: string; active: boolean; complete: boolean }
type StoryState = { stageId: StageId; decision: DecisionId }

function StageNode({ data, selected }: NodeProps<Node<StageNodeData>>) {
  return <div className={`stage-node ${selected || data.active ? 'is-selected' : ''} ${data.complete ? 'is-complete' : ''}`}>
    <Handle type="target" position={Position.Left} />
    <span>{data.step}</span>
    <strong>{data.title}</strong>
    <Handle type="source" position={Position.Right} />
  </div>
}

const nodeTypes = { stage: StageNode }

function App() {
  const [story, setStory] = useState<StoryState>({ stageId: 'detection', decision: 'pending' })
  const [resetViewToken, setResetViewToken] = useState(0)
  const stageIndex = storyStages.findIndex((item) => item.id === story.stageId)
  const stage = getStoryStage(story.stageId, story.decision)

  const selectStage = useCallback((stageId: StageId) => {
    setStory((current) => ({ ...current, stageId }))
  }, [])

  const selectDecision = useCallback((decision: Exclude<DecisionId, 'pending'>) => {
    setStory({ stageId: 'decision', decision })
  }, [])

  const nodes = useMemo<Node<StageNodeData>[]>(() => storyStages.map((item, index) => ({
    id: item.id,
    type: 'stage',
    position: { x: index * 238, y: 26 },
    selected: item.id === story.stageId,
    data: { step: item.step, title: item.shortTitle, active: item.id === story.stageId, complete: index < stageIndex },
  })), [stageIndex, story.stageId])

  const edges = useMemo(() => storyStages.slice(0, -1).map((item, index) => ({
    id: `${item.id}-${storyStages[index + 1].id}`,
    source: item.id,
    target: storyStages[index + 1].id,
    animated: index === Math.min(stageIndex, storyStages.length - 2),
    markerEnd: { type: MarkerType.ArrowClosed },
    className: index < stageIndex ? 'is-complete' : '',
  })), [stageIndex])

  const moveStage = (direction: number) => {
    const nextIndex = (stageIndex + direction + storyStages.length) % storyStages.length
    selectStage(storyStages[nextIndex].id)
  }

  const outcomeLabel = outcomeForDecision[story.decision].replace('-', ' ')

  return <MotionConfig reducedMotion="user" transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}>
    <main className="app-shell" data-stage={stage.id}>
      <header className="app-header">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">A</span>
          <div><p className="eyebrow">ARKA · RETAIL INTELLIGENCE</p><h1>Sales decline investigation</h1></div>
        </div>
        <div className="header-meta"><span className="live-state"><i />SIMULATION ACTIVE</span><span>Local mock data</span></div>
      </header>

      <nav className="story-nav" aria-label="Story stages">
        {storyStages.map((item, index) => <button type="button" key={item.id} className={item.id === stage.id ? 'is-active' : ''} aria-current={item.id === stage.id ? 'step' : undefined} onClick={() => selectStage(item.id)}>
          <span>{String(index + 1).padStart(2, '0')}</span>{item.shortTitle}
        </button>)}
      </nav>

      <section className="workspace" aria-label="Sales decline story workspace">
        <div className="canvas-wrap">
          <div className="presentation-head">
            <div><span className="section-label">PRESENTATION CANVAS</span><p>Select a structure · Drag to orbit · Scroll to zoom</p></div>
            <div className="scene-actions">
              <span className={`outcome-chip outcome-${outcomeForDecision[story.decision]}`}>{story.decision === 'pending' ? 'NO DECISION' : outcomeLabel}</span>
              <button type="button" className="reset-view" onClick={() => setResetViewToken((value) => value + 1)}>Reset View</button>
            </div>
          </div>

          <div className="visual-grid">
            <RetailScene
              stageId={story.stageId}
              decision={story.decision}
              resetViewToken={resetViewToken}
              onStageSelect={selectStage}
              onDecisionSelect={selectDecision}
            />
            <TrendCharts stage={stage} />
          </div>

          <div className="flow-section" aria-label="Story workflow">
            <div className="flow-heading"><span className="section-label">STORY FLOW</span><p>One simulated decision journey</p></div>
            <div className="flow-canvas">
              <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={(_, node) => selectStage(node.id as StageId)} fitView fitViewOptions={{ padding: 0.08 }} minZoom={0.72} maxZoom={1.15} nodesDraggable={false} nodesConnectable={false} panOnDrag={false} zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false} elementsSelectable proOptions={{ hideAttribution: true }}>
                <Background gap={28} size={1} color="#1e2a43" />
              </ReactFlow>
            </div>
          </div>
        </div>

        <aside className="story-rail" aria-label="Current story stage">
          <div className="rail-index"><span>{stage.step}</span><small>OF 05</small></div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.article key={`${stage.id}-${story.decision}`} className="narrative" data-testid="narrative" data-stage={stage.id} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.22 }}>
              <p className="eyebrow">{stage.eyebrow}</p>
              <h2>{stage.title}</h2>
              <p className="summary">{stage.summary}</p>
              {stage.id === 'decision' && <div className="decision-controls" aria-label="Simulated manager decision">
                <span>SIMULATED RESPONSE</span>
                {decisionOptions.map((option) => <button type="button" key={option.id} className={story.decision === option.id ? 'is-selected' : ''} aria-pressed={story.decision === option.id} onClick={() => selectDecision(option.id)}>
                  <i aria-hidden="true" />{option.label}
                </button>)}
              </div>}
              <div className="rail-detail"><span>INVESTIGATION NOTE</span><p>{stage.insight}</p></div>
              <div className="rail-detail"><span>NEXT ACTION</span><p>{stage.action}</p></div>
            </motion.article>
          </AnimatePresence>
          <div className="rail-controls">
            <button type="button" className="icon-button" aria-label="Previous story stage" onClick={() => moveStage(-1)}>←</button>
            <div><span>{stage.shortTitle}</span><small>{Math.round(((stageIndex + 1) / storyStages.length) * 100)}% complete</small></div>
            <button type="button" className="icon-button primary" aria-label="Next story stage" onClick={() => moveStage(1)}>→</button>
          </div>
        </aside>
      </section>
    </main>
  </MotionConfig>
}

export default App

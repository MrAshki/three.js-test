import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three/webgpu'
import { color, mix, sin, time } from 'three/tsl'
import {
  outcomeForDecision,
  stageOrder,
  type DecisionId,
  type OutcomeId,
  type StageId,
} from '../storyData'

type RetailSceneProps = {
  stageId: StageId
  decision: DecisionId
  resetViewToken: number
  onStageSelect: (stageId: StageId) => void
  onDecisionSelect: (decision: Exclude<DecisionId, 'pending'>) => void
}

type MaterialState = {
  material: THREE.MeshStandardNodeMaterial
  baseColor: THREE.Color
}

type StageVisual = {
  id: StageId
  group: THREE.Group
  halo: THREE.Mesh
  materials: MaterialState[]
}

type ConnectorVisual = {
  material: THREE.MeshStandardNodeMaterial
  pulses: THREE.Mesh[]
  start: THREE.Vector3
  end: THREE.Vector3
}

const stagePositions: Record<StageId, THREE.Vector3> = {
  detection: new THREE.Vector3(-6, 0, 0.35),
  evidence: new THREE.Vector3(-3, 0.15, -0.1),
  recommendation: new THREE.Vector3(0, 0.35, 0.25),
  decision: new THREE.Vector3(3, 0.05, -0.1),
  outcome: new THREE.Vector3(6, 0.2, 0.25),
}

const stageLabels: Array<{ id: StageId; step: string; title: string }> = [
  { id: 'detection', step: '01', title: 'Detection' },
  { id: 'evidence', step: '02', title: 'Evidence' },
  { id: 'recommendation', step: '03', title: 'AI Recommendation' },
  { id: 'decision', step: '04', title: 'Manager Decision' },
  { id: 'outcome', step: '05', title: 'Outcome' },
]

const outcomeColors: Record<OutcomeId, string> = {
  improvement: '#22c55e',
  deterioration: '#fb7185',
  'no-change': '#8ea0b8',
  'too-early': '#fbbf24',
}

function createMaterial(hex: string, opacity = 1) {
  const material = new THREE.MeshStandardNodeMaterial({
    color: hex,
    emissive: hex,
    emissiveIntensity: 0.12,
    metalness: 0.28,
    roughness: 0.48,
    transparent: opacity < 1,
    opacity,
  })
  return material
}

function placeBeam(mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3) {
  const direction = end.clone().sub(start)
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.scale.y = direction.length()
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
}

export function RetailScene({ stageId, decision, resetViewToken, onStageSelect, onDecisionSelect }: RetailSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const labelRefs = useRef<Partial<Record<StageId, HTMLButtonElement>>>({})
  const stateRef = useRef({ stageId, decision, resetViewToken })
  const stageCallbackRef = useRef(onStageSelect)
  const decisionCallbackRef = useRef(onDecisionSelect)
  const [rendererLabel, setRendererLabel] = useState('Initializing')
  const [rendererError, setRendererError] = useState('')

  stateRef.current = { stageId, decision, resetViewToken }
  stageCallbackRef.current = onStageSelect
  decisionCallbackRef.current = onDecisionSelect

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let initialized = false
    let overview = true
    let lastStageId: StageId = stateRef.current.stageId
    let lastResetToken = stateRef.current.resetViewToken
    let orbitYaw = 0
    let orbitPitch = 0
    let zoomOffset = 0
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0b1020')
    scene.fog = new THREE.Fog('#0b1020', 12, 29)

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60)
    camera.position.set(0, 3.1, 16.5)
    camera.lookAt(0, 0, 0)

    const forceWebGL = new URLSearchParams(window.location.search).has('forceWebgl')
    const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: false, forceWebGL })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.domElement.setAttribute('role', 'application')
    renderer.domElement.setAttribute('aria-label', 'Interactive 3D decision journey. Use arrow keys or number keys to select a stage. Drag to orbit and scroll to zoom.')
    renderer.domElement.setAttribute('tabindex', '0')
    renderer.domElement.dataset.testid = 'retail-3d-canvas'
    host.appendChild(renderer.domElement)

    const world = new THREE.Group()
    scene.add(world)
    scene.add(new THREE.HemisphereLight('#b8d7ff', '#06111f', 1.45))
    const keyLight = new THREE.DirectionalLight('#dbeafe', 2.2)
    keyLight.position.set(4, 7, 9)
    scene.add(keyLight)

    const floorMaterial = new THREE.MeshBasicNodeMaterial({ color: '#111a2d', transparent: true, opacity: 0.62 })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 6), floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.32
    world.add(floor)

    const pickables: THREE.Mesh[] = []
    const stageVisuals: StageVisual[] = []
    const decisionMeshes: Array<{ mesh: THREE.Mesh; id: Exclude<DecisionId, 'pending'>; material: THREE.MeshStandardNodeMaterial }> = []
    const outcomeMeshes: Array<{ mesh: THREE.Mesh; id: OutcomeId; material: THREE.MeshStandardNodeMaterial }> = []

    const createStage = (id: StageId, accent: string) => {
      const group = new THREE.Group()
      group.position.copy(stagePositions[id])
      group.userData.stageId = id
      world.add(group)

      const materials: MaterialState[] = []
      const addMesh = (geometry: THREE.BufferGeometry, hex = accent, opacity = 1) => {
        const material = createMaterial(hex, opacity)
        const mesh = new THREE.Mesh(geometry, material)
        mesh.userData.stageId = id
        group.add(mesh)
        pickables.push(mesh)
        materials.push({ material, baseColor: new THREE.Color(hex) })
        return mesh
      }

      const base = addMesh(new THREE.CylinderGeometry(1.02, 1.15, 0.18, 32), '#182343', 0.94)
      base.position.y = -1.13

      const haloMaterial = new THREE.MeshBasicNodeMaterial({ color: accent, transparent: true, opacity: 0.2 })
      const halo = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.025, 8, 72), haloMaterial)
      halo.position.y = -1.02
      halo.rotation.x = Math.PI / 2
      group.add(halo)

      const visual = { id, group, halo, materials }
      stageVisuals.push(visual)
      return { group, addMesh, visual }
    }

    const detection = createStage('detection', '#fb7185')
    ;[1.35, 0.98, 0.62].forEach((height, index) => {
      const bar = detection.addMesh(new THREE.BoxGeometry(0.34, height, 0.48), '#fb7185')
      bar.position.set(-0.52 + index * 0.52, -0.98 + height / 2, 0)
    })
    const warningRing = detection.addMesh(new THREE.TorusGeometry(0.84, 0.07, 10, 56), '#fb7185', 0.88)
    warningRing.position.y = 0.08
    const warningTick = detection.addMesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), '#f8fafc')
    warningTick.position.y = 0.18
    const warningDot = detection.addMesh(new THREE.SphereGeometry(0.1, 16, 12), '#f8fafc')
    warningDot.position.y = -0.33

    const evidence = createStage('evidence', '#60a5fa')
    ;[0.9, 0.68, 0.46].forEach((height, index) => {
      const sales = evidence.addMesh(new THREE.BoxGeometry(0.28, height, 0.34), '#60a5fa')
      sales.position.set(-0.5, -0.99 + height / 2, -0.2 + index * 0.2)
      const stockHeight = 0.45 + index * 0.25
      const stock = evidence.addMesh(new THREE.BoxGeometry(0.28, stockHeight, 0.34), '#fbbf24')
      stock.position.set(0.5, -0.99 + stockHeight / 2, -0.2 + index * 0.2)
    })
    const evidenceBridge = evidence.addMesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 10), '#cbd5e1', 0.7)
    evidenceBridge.rotation.z = Math.PI / 2
    evidenceBridge.position.y = 0.05
    const unverified = evidence.addMesh(new THREE.TorusGeometry(0.22, 0.035, 8, 32), '#8ea0b8', 0.55)
    unverified.position.set(0, 0.55, 0)

    const recommendation = createStage('recommendation', '#60a5fa')
    const core = recommendation.addMesh(new THREE.OctahedronGeometry(0.68, 1), '#60a5fa')
    core.position.y = 0.05
    ;[-0.85, 0, 0.85].forEach((x, index) => {
      const input = recommendation.addMesh(new THREE.SphereGeometry(0.14, 18, 12), index === 1 ? '#fbbf24' : '#fb7185')
      input.position.set(x, -0.75, 0)
      const beam = recommendation.addMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 8), '#60a5fa', 0.68)
      placeBeam(beam, new THREE.Vector3(x, -0.58, 0), new THREE.Vector3(0, -0.2, 0))
    })
    const proposal = recommendation.addMesh(new THREE.BoxGeometry(0.9, 0.16, 0.6), '#f8fafc', 0.9)
    proposal.position.y = 0.92

    const decisionStage = createStage('decision', '#fbbf24')
    const gateway = decisionStage.addMesh(new THREE.TorusGeometry(0.72, 0.12, 14, 64), '#fbbf24')
    gateway.position.y = 0.12
    const branchData: Array<{ id: Exclude<DecisionId, 'pending'>; x: number; color: string }> = [
      { id: 'approve', x: -0.72, color: '#22c55e' },
      { id: 'reject', x: 0, color: '#fb7185' },
      { id: 'analysis', x: 0.72, color: '#60a5fa' },
    ]
    branchData.forEach((branch) => {
      const mesh = decisionStage.addMesh(new THREE.CylinderGeometry(0.25, 0.3, 0.18, 6), branch.color)
      mesh.position.set(branch.x, -0.78, 0)
      mesh.userData.decisionId = branch.id
      decisionMeshes.push({ mesh, id: branch.id, material: mesh.material as THREE.MeshStandardNodeMaterial })
    })

    const outcomeStage = createStage('outcome', '#22c55e')
    const outcomeCore = outcomeStage.addMesh(new THREE.SphereGeometry(0.34, 24, 16), '#f8fafc')
    outcomeCore.position.y = 0.05
    const outcomeData: Array<{ id: OutcomeId; position: [number, number, number] }> = [
      { id: 'improvement', position: [-0.68, 0.65, 0] },
      { id: 'deterioration', position: [0.68, 0.65, 0] },
      { id: 'no-change', position: [-0.68, -0.62, 0] },
      { id: 'too-early', position: [0.68, -0.62, 0] },
    ]
    outcomeData.forEach((result) => {
      const beam = outcomeStage.addMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.64, 8), outcomeColors[result.id], 0.5)
      placeBeam(beam, new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(...result.position).multiplyScalar(0.78))
      const mesh = outcomeStage.addMesh(new THREE.IcosahedronGeometry(0.2, 1), outcomeColors[result.id])
      mesh.position.set(...result.position)
      mesh.userData.outcomeId = result.id
      outcomeMeshes.push({ mesh, id: result.id, material: mesh.material as THREE.MeshStandardNodeMaterial })
    })

    const connectors: ConnectorVisual[] = []
    const pulseMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.95 })
    pulseMaterial.colorNode = mix(color('#60a5fa'), color('#f8fafc'), sin(time.mul(3.2)).mul(0.5).add(0.5))

    for (let index = 0; index < stageOrder.length - 1; index += 1) {
      const start = stagePositions[stageOrder[index]].clone().add(new THREE.Vector3(1.15, -0.05, 0))
      const end = stagePositions[stageOrder[index + 1]].clone().add(new THREE.Vector3(-1.15, -0.05, 0))
      const material = createMaterial('#293653', 0.55)
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 10), material)
      placeBeam(beam, start, end)
      world.add(beam)

      const direction = end.clone().sub(start).normalize()
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 12), material)
      arrow.position.copy(end).addScaledVector(direction, -0.05)
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
      world.add(arrow)

      const pulses = Array.from({ length: 3 }, () => {
        const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), pulseMaterial)
        world.add(pulse)
        return pulse
      })
      connectors.push({ material, pulses, start, end })
    }

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const projected = new THREE.Vector3()
    const cameraGoal = new THREE.Vector3()
    const lookGoal = new THREE.Vector3()
    const lookCurrent = new THREE.Vector3(0, 0, 0)
    const timer = new THREE.Timer()
    timer.connect(document)
    let dragging = false
    let moved = false
    let lastX = 0
    let lastY = 0

    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const selectAtPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(pickables, false)[0]?.object
      if (!hit) return
      if (hit.userData.decisionId) decisionCallbackRef.current(hit.userData.decisionId)
      else if (hit.userData.stageId) stageCallbackRef.current(hit.userData.stageId)
    }

    const onPointerDown = (event: PointerEvent) => {
      dragging = true
      moved = false
      lastX = event.clientX
      lastY = event.clientY
      renderer.domElement.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return
      const dx = event.clientX - lastX
      const dy = event.clientY - lastY
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
      orbitYaw = THREE.MathUtils.clamp(orbitYaw - dx * 0.004, -0.55, 0.55)
      orbitPitch = THREE.MathUtils.clamp(orbitPitch + dy * 0.003, -0.35, 0.35)
      lastX = event.clientX
      lastY = event.clientY
    }

    const onPointerUp = (event: PointerEvent) => {
      dragging = false
      if (!moved) selectAtPointer(event)
    }

    const onPointerCancel = () => { dragging = false }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoomOffset = THREE.MathUtils.clamp(zoomOffset + event.deltaY * 0.007, -2.2, 5)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const currentIndex = stageOrder.indexOf(stateRef.current.stageId)
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault()
        const direction = event.key === 'ArrowRight' ? 1 : -1
        stageCallbackRef.current(stageOrder[(currentIndex + direction + stageOrder.length) % stageOrder.length])
      } else if (/^[1-5]$/.test(event.key)) {
        event.preventDefault()
        stageCallbackRef.current(stageOrder[Number(event.key) - 1])
      } else if (event.key === 'Home') {
        event.preventDefault()
        overview = true
        orbitYaw = 0
        orbitPitch = 0
        zoomOffset = 0
      }
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMotionPreference = () => { reducedMotion = mediaQuery.matches }
    const onContextLost = (event: Event) => {
      event.preventDefault()
      setRendererLabel('Renderer context lost')
    }
    const onContextRestored = () => setRendererLabel('Renderer restored')

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointercancel', onPointerCancel)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })
    renderer.domElement.addEventListener('keydown', onKeyDown)
    renderer.domElement.addEventListener('webglcontextlost', onContextLost)
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored)
    mediaQuery.addEventListener('change', onMotionPreference)

    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    const renderFrame = () => {
      if (disposed) return
      timer.update()
      const delta = Math.min(timer.getDelta(), 0.05)
      const elapsed = timer.getElapsed()
      const current = stateRef.current

      if (current.resetViewToken !== lastResetToken) {
        lastResetToken = current.resetViewToken
        overview = true
        orbitYaw = 0
        orbitPitch = 0
        zoomOffset = 0
      }
      if (current.stageId !== lastStageId) {
        lastStageId = current.stageId
        overview = false
      }

      const stageIndex = stageOrder.indexOf(current.stageId)
      const focus = stagePositions[current.stageId]
      const cameraDistance = (overview ? 16.5 : 7.8) + zoomOffset
      const centerX = overview ? 0 : focus.x
      const centerY = overview ? 0.15 : focus.y
      cameraGoal.set(
        centerX + Math.sin(orbitYaw) * cameraDistance * 0.3,
        (overview ? 3.1 : 2.55) + orbitPitch * 4,
        Math.cos(orbitYaw) * cameraDistance,
      )
      lookGoal.set(centerX, centerY, 0)
      const cameraEase = reducedMotion ? 1 : 1 - Math.pow(0.001, delta)
      camera.position.lerp(cameraGoal, cameraEase)
      lookCurrent.lerp(lookGoal, cameraEase)
      camera.lookAt(lookCurrent)

      stageVisuals.forEach((visual, index) => {
        const isActive = visual.id === current.stageId
        const isPast = index < stageIndex
        const opacityTarget = isActive ? 1 : isPast ? 0.5 : 0.26
        const scaleTarget = isActive ? 1.08 : 0.94
        visual.group.scale.lerp(new THREE.Vector3(scaleTarget, scaleTarget, scaleTarget), reducedMotion ? 1 : 0.08)
        visual.materials.forEach(({ material, baseColor }) => {
          material.opacity = THREE.MathUtils.lerp(material.opacity, opacityTarget, reducedMotion ? 1 : 0.09)
          material.transparent = material.opacity < 0.99
          material.emissive.copy(baseColor)
          material.emissiveIntensity = isActive ? 0.42 : isPast ? 0.16 : 0.06
        })
        const haloMaterial = visual.halo.material as THREE.MeshBasicNodeMaterial
        haloMaterial.opacity = THREE.MathUtils.lerp(haloMaterial.opacity, isActive ? 0.72 : 0.1, reducedMotion ? 1 : 0.08)
        if (isActive && !reducedMotion) visual.halo.rotation.z += delta * 0.3
      })

      const activeConnector = Math.min(stageIndex, connectors.length - 1)
      connectors.forEach((connector, index) => {
        const isActive = index === activeConnector
        const isPast = index < stageIndex
        const targetColor = new THREE.Color(isActive ? '#60a5fa' : isPast ? '#22c55e' : '#293653')
        connector.material.color.lerp(targetColor, reducedMotion ? 1 : 0.1)
        connector.material.emissive.copy(connector.material.color)
        connector.material.emissiveIntensity = isActive ? 0.55 : 0.08
        connector.material.opacity = isActive ? 0.95 : isPast ? 0.58 : 0.22
        connector.pulses.forEach((pulse, pulseIndex) => {
          pulse.visible = isActive
          if (!isActive) return
          const progress = reducedMotion ? 0.55 : (elapsed * 0.38 + pulseIndex / 3) % 1
          pulse.position.lerpVectors(connector.start, connector.end, progress)
        })
      })

      decisionMeshes.forEach((branch) => {
        const selected = current.decision === branch.id
        branch.material.opacity = current.decision === 'pending' || selected ? 1 : 0.28
        branch.material.emissiveIntensity = selected ? 0.85 : 0.18
        branch.mesh.scale.setScalar(selected ? 1.28 : 1)
      })

      const activeOutcome = outcomeForDecision[current.decision]
      outcomeMeshes.forEach((result) => {
        const selected = result.id === activeOutcome
        result.material.opacity = selected ? 1 : 0.24
        result.material.emissiveIntensity = selected ? 0.9 : 0.08
        result.mesh.scale.setScalar(selected ? 1.35 : 0.82)
      })

      stageLabels.forEach((label) => {
        const element = labelRefs.current[label.id]
        if (!element) return
        projected.copy(stagePositions[label.id]).add(new THREE.Vector3(0, 1.7, 0)).project(camera)
        const x = (projected.x * 0.5 + 0.5) * host.clientWidth
        const y = (-projected.y * 0.5 + 0.5) * host.clientHeight
        element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
        element.hidden = projected.z < -1 || projected.z > 1
      })

      renderer.render(scene, camera)
    }

    const onVisibilityChange = () => {
      if (!initialized || disposed) return
      renderer.setAnimationLoop(document.hidden ? null : renderFrame)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    renderer.init().then(() => {
      if (disposed) return
      initialized = true
      const backend = renderer.backend as unknown as { isWebGPUBackend?: boolean }
      setRendererLabel(backend.isWebGPUBackend ? 'WebGPU + TSL' : 'WebGL 2 fallback + TSL')
      renderer.setAnimationLoop(renderFrame)
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'The renderer could not start.'
      setRendererLabel('Renderer unavailable')
      setRendererError(message)
    })

    return () => {
      disposed = true
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      mediaQuery.removeEventListener('change', onMotionPreference)
      renderer.setAnimationLoop(null)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel)
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.domElement.removeEventListener('keydown', onKeyDown)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored)
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => material.dispose())
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  const selectedDecision = decision === 'pending' ? 'Decision required' : decision === 'analysis' ? 'More analysis' : decision
  const activeOutcome = outcomeForDecision[decision].replace('-', ' ')

  return <div className="scene-shell">
    <div ref={hostRef} className="scene-host" />
    <div className="scene-label-layer" aria-label="3D workflow stages">
      {stageLabels.map((label) => <button
        type="button"
        key={label.id}
        ref={(element) => { if (element) labelRefs.current[label.id] = element }}
        className={`scene-stage-label ${stageId === label.id ? 'is-active' : ''}`}
        onClick={() => onStageSelect(label.id)}
      >
        <span>{label.step}</span><strong>{label.title}</strong>
        <small>{label.id === 'detection' ? '−18% sales' : label.id === 'evidence' ? 'Observed, not causal' : label.id === 'recommendation' ? 'Review replenishment' : label.id === 'decision' ? selectedDecision : activeOutcome}</small>
      </button>)}
    </div>
    <div className="scene-toolbar">
      <span><i className="scene-dot" />Decision journey</span>
      <span data-testid="renderer-label">{rendererLabel}</span>
    </div>
    {rendererError && <div className="scene-error" role="alert">3D view unavailable: {rendererError}</div>}
    <div className="scene-legend" aria-label="Scene state legend">
      <span><i className="confirmed" />Observed</span>
      <span><i className="unverified" />Unverified</span>
      <span><i className="active-flow" />Active flow</span>
    </div>
  </div>
}

import type { ComponentType } from 'react'
import EligibilityAI from './EligibilityAI'
import PriorAuthorizationAI from './PriorAuthorizationAI'
import CodingAI from './CodingAI'
import ARDenialManagement from './ARDenialManagement'
import AppealsAI from './AppealsAI'
import PerformanceAI from './PerformanceAI'
import {
  EligibilityIcon,
  PriorAuthIcon,
  CodingIcon,
  ARDenialIcon,
  AppealsIcon,
  PerformanceIcon,
} from './icons'

export interface AIModule {
  id: string
  name: string
  icon: ComponentType<{ className?: string }>
  Component: ComponentType
}

export const modules: AIModule[] = [
  { id: 'eligibility-ai', name: 'Eligibility AI', icon: EligibilityIcon, Component: EligibilityAI },
  { id: 'prior-authorization-ai', name: 'Prior Authorization AI', icon: PriorAuthIcon, Component: PriorAuthorizationAI },
  { id: 'coding-ai', name: 'Coding AI', icon: CodingIcon, Component: CodingAI },
  { id: 'ar-denial-management', name: 'AR & Denial Management', icon: ARDenialIcon, Component: ARDenialManagement },
  { id: 'appeals-ai', name: 'Appeals AI', icon: AppealsIcon, Component: AppealsAI },
  { id: 'performance-ai', name: 'Performance AI', icon: PerformanceIcon, Component: PerformanceAI },
]

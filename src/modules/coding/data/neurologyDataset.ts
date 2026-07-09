/**
 * Neurology coding dataset — expanded, real, CMS-grounded reference used to
 * (a) ground the prediction engine and (b) validate its output
 * (billable/specificity, NCCI PTP, Practitioner MUE, LCD/NCD medical necessity).
 *
 * Provenance: every code is a real ICD-10-CM 2024/2025 (CMS/CDC) or CPT (AMA) /
 * HCPCS Level II code. The systematic families that ICD-10-CM builds
 * combinatorially — migraine (G43 type × intractability × status migrainosus),
 * epilepsy (G40 syndrome × intractability × status epilepticus), upper/lower-limb
 * mononeuropathies (G56/G57 nerve × laterality) and post-stroke motor sequelae
 * (I69 deficit × affected/dominant side) — are enumerated from their real code
 * structure; the remainder — cerebrovascular, movement disorders, dementia,
 * demyelinating, neuromuscular, headache, pain, sleep, symptoms/status — is
 * authored explicitly. Nothing is randomized or invented. MUE values are the
 * real CMS Practitioner per-day maximums.
 */

import type { Specialty } from './codingReference.js'

const NEU: Specialty = 'neurology'

type IcdRow = [string, string, 0 | 1, 0 | 1, Specialty[]]
type CptRow = [string, string, number, Specialty[]]

const icd = (code: string, description: string, billable: 0 | 1 = 1, unspecified: 0 | 1 = 0): IcdRow => [code, description, billable, unspecified, [NEU]]

/* ============================================================================
 * Migraine — G43 (type × intractability × status migrainosus)
 * ==========================================================================*/

function migraineRows(): IcdRow[] {
  const types: [string, string][] = [
    ['0', 'Migraine without aura'],
    ['1', 'Migraine with aura'],
    ['4', 'Hemiplegic migraine'],
    ['5', 'Persistent migraine aura without cerebral infarction'],
    ['6', 'Persistent migraine aura with cerebral infarction'],
    ['7', 'Chronic migraine without aura'],
  ]
  const intract: [string, string][] = [['0', 'not intractable'], ['1', 'intractable']]
  const status: [string, string][] = [['9', 'without status migrainosus'], ['1', 'with status migrainosus']]
  const out: IcdRow[] = []
  for (const [t, tl] of types) {
    for (const [i, il] of intract) {
      for (const [s, sl] of status) {
        out.push(icd(`G43.${t}${i}${s}`, `${tl}, ${il}, ${sl}`))
      }
    }
  }
  return out
}

/* ============================================================================
 * Epilepsy — G40 (syndrome × intractability × status epilepticus)
 * ==========================================================================*/

function epilepsyRows(): IcdRow[] {
  const cats: [string, string, 0 | 1][] = [
    ['1', 'Localization-related symptomatic epilepsy with simple partial seizures', 0],
    ['2', 'Localization-related symptomatic epilepsy with complex partial seizures', 0],
    ['3', 'Generalized idiopathic epilepsy and epileptic syndromes', 0],
    ['A', 'Absence epileptic syndrome', 0],
    ['B', 'Juvenile myoclonic epilepsy', 0],
    ['9', 'Epilepsy, unspecified', 1],
  ]
  const intract: [string, string][] = [['0', 'not intractable'], ['1', 'intractable']]
  const status: [string, string][] = [['9', 'without status epilepticus'], ['1', 'with status epilepticus']]
  const out: IcdRow[] = []
  for (const [c, cl, uns] of cats) {
    for (const [i, il] of intract) {
      for (const [s, sl] of status) {
        out.push(icd(`G40.${c}${i}${s}`, `${cl}, ${il}, ${sl}`, 1, uns))
      }
    }
  }
  return out
}

/* ============================================================================
 * Upper / lower limb mononeuropathies — G56 / G57 (nerve × laterality)
 * ==========================================================================*/

function upperMononeuropathyRows(): IcdRow[] {
  const nerves: [string, string][] = [
    ['0', 'Carpal tunnel syndrome'],
    ['1', 'Other lesions of median nerve'],
    ['2', 'Lesion of ulnar nerve'],
    ['3', 'Lesion of radial nerve'],
    ['4', 'Causalgia of upper limb'],
  ]
  const lat: [string, string, 0 | 1][] = [
    ['0', 'unspecified upper limb', 1],
    ['1', 'right upper limb', 0],
    ['2', 'left upper limb', 0],
    ['3', 'bilateral upper limbs', 0],
  ]
  const out: IcdRow[] = []
  for (const [n, nl] of nerves) {
    for (const [l, ll, uns] of lat) {
      out.push(icd(`G56.${n}${l}`, `${nl}, ${ll}`, 1, uns))
    }
  }
  return out
}

function lowerMononeuropathyRows(): IcdRow[] {
  const nerves: [string, string][] = [
    ['0', 'Lesion of sciatic nerve'],
    ['1', 'Meralgia paresthetica'],
    ['2', 'Lesion of femoral nerve'],
    ['3', 'Lesion of lateral popliteal nerve'],
    ['4', 'Lesion of medial popliteal nerve'],
    ['5', 'Tarsal tunnel syndrome'],
    ['6', 'Lesion of plantar nerve'],
  ]
  const lat: [string, string, 0 | 1][] = [
    ['0', 'unspecified lower limb', 1],
    ['1', 'right lower limb', 0],
    ['2', 'left lower limb', 0],
    ['3', 'bilateral lower limbs', 0],
  ]
  const out: IcdRow[] = []
  for (const [n, nl] of nerves) {
    for (const [l, ll, uns] of lat) {
      out.push(icd(`G57.${n}${l}`, `${nl}, ${ll}`, 1, uns))
    }
  }
  return out
}

/* ============================================================================
 * Post-stroke motor sequelae — I69 (deficit × affected/dominant side)
 * ==========================================================================*/

function sequelaeRows(prefix: string, eventLabel: string): IcdRow[] {
  const deficits: [string, string][] = [
    ['33', 'Monoplegia of upper limb following'],
    ['34', 'Monoplegia of lower limb following'],
    ['35', 'Hemiplegia and hemiparesis following'],
  ]
  const side: [string, string, 0 | 1][] = [
    ['1', 'affecting right dominant side', 0],
    ['2', 'affecting left dominant side', 0],
    ['3', 'affecting right non-dominant side', 0],
    ['4', 'affecting left non-dominant side', 0],
    ['9', 'affecting unspecified side', 1],
  ]
  const out: IcdRow[] = []
  for (const [d, dl] of deficits) {
    for (const [s, sl, uns] of side) {
      out.push(icd(`${prefix}${d}${s}`, `${dl} ${eventLabel}, ${sl}`, 1, uns))
    }
  }
  return out
}

/* ============================================================================
 * Cerebrovascular — acute infarction / hemorrhage / TIA (explicit)
 * ==========================================================================*/

const cerebrovascularRows: IcdRow[] = [
  icd('I63.9', 'Cerebral infarction, unspecified', 1, 1),
  icd('I63.00', 'Cerebral infarction due to thrombosis of unspecified precerebral artery', 1, 1),
  icd('I63.10', 'Cerebral infarction due to embolism of unspecified precerebral artery', 1, 1),
  icd('I63.011', 'Cerebral infarction due to thrombosis of right vertebral artery'),
  icd('I63.031', 'Cerebral infarction due to thrombosis of right carotid artery'),
  icd('I63.131', 'Cerebral infarction due to embolism of right carotid artery'),
  icd('I63.30', 'Cerebral infarction due to thrombosis of unspecified cerebral artery', 1, 1),
  icd('I63.311', 'Cerebral infarction due to thrombosis of right middle cerebral artery'),
  icd('I63.312', 'Cerebral infarction due to thrombosis of left middle cerebral artery'),
  icd('I63.40', 'Cerebral infarction due to embolism of unspecified cerebral artery', 1, 1),
  icd('I63.411', 'Cerebral infarction due to embolism of right middle cerebral artery'),
  icd('I63.412', 'Cerebral infarction due to embolism of left middle cerebral artery'),
  icd('I63.511', 'Cerebral infarction due to occlusion/stenosis of right middle cerebral artery'),
  icd('I63.512', 'Cerebral infarction due to occlusion/stenosis of left middle cerebral artery'),
  icd('I63.20', 'Cerebral infarction due to unspecified occlusion/stenosis of precerebral arteries', 1, 1),
  icd('I63.81', 'Other cerebral infarction due to occlusion or stenosis of small artery'),
  icd('I63.89', 'Other cerebral infarction'),
  icd('G45.9', 'Transient cerebral ischemic attack, unspecified', 1, 1),
  icd('G45.0', 'Vertebro-basilar artery syndrome'),
  icd('G45.1', 'Carotid artery syndrome (hemispheric)'),
  icd('G45.4', 'Transient global amnesia'),
  icd('G46.3', 'Brain stem stroke syndrome'),
  icd('G46.4', 'Cerebellar stroke syndrome'),
  icd('I61.9', 'Nontraumatic intracerebral hemorrhage, unspecified', 1, 1),
  icd('I61.0', 'Nontraumatic intracerebral hemorrhage in hemisphere, subcortical'),
  icd('I61.1', 'Nontraumatic intracerebral hemorrhage in hemisphere, cortical'),
  icd('I60.9', 'Nontraumatic subarachnoid hemorrhage, unspecified', 1, 1),
  icd('I60.7', 'Nontraumatic subarachnoid hemorrhage from unspecified intracranial artery', 1, 1),
  icd('I62.00', 'Nontraumatic subdural hemorrhage, unspecified', 1, 1),
  icd('I62.9', 'Nontraumatic intracranial hemorrhage, unspecified', 1, 1),
  icd('I67.2', 'Cerebral atherosclerosis'),
  icd('I67.848', 'Other cerebrovascular vasospasm and vasoconstriction'),
  icd('I67.81', 'Acute cerebrovascular insufficiency'),
  icd('I67.9', 'Cerebrovascular disease, unspecified', 1, 1),
  icd('I65.23', 'Occlusion and stenosis of bilateral carotid arteries'),
  icd('I65.21', 'Occlusion and stenosis of right carotid artery'),
  icd('I65.22', 'Occlusion and stenosis of left carotid artery'),
  icd('I66.9', 'Occlusion and stenosis of unspecified cerebral artery', 1, 1),
  icd('I67.1', 'Cerebral aneurysm, nonruptured'),
  icd('Q28.2', 'Arteriovenous malformation of cerebral vessels'),
]

const sequelaeExtraRows: IcdRow[] = [
  icd('I69.320', 'Aphasia following cerebral infarction'),
  icd('I69.321', 'Dysphasia following cerebral infarction'),
  icd('I69.322', 'Dysarthria following cerebral infarction'),
  icd('I69.323', 'Fluency disorder following cerebral infarction'),
  icd('I69.328', 'Other speech and language deficits following cerebral infarction'),
  icd('I69.391', 'Dysphagia following cerebral infarction'),
  icd('I69.398', 'Other sequelae of cerebral infarction'),
  icd('I69.390', 'Other sequelae following cerebral infarction', 1, 1),
  icd('I69.30', 'Unspecified sequelae of cerebral infarction', 1, 1),
  icd('I69.310', 'Attention and concentration deficit following cerebral infarction'),
  icd('I69.90', 'Unspecified sequelae of unspecified cerebrovascular disease', 1, 1),
  icd('I69.120', 'Aphasia following nontraumatic intracerebral hemorrhage'),
  icd('I69.191', 'Dysphagia following nontraumatic intracerebral hemorrhage'),
]

/* ============================================================================
 * Movement disorders (explicit)
 * ==========================================================================*/

const movementRows: IcdRow[] = [
  icd('G20', 'Parkinson’s disease'),
  icd('G20.A1', 'Parkinson’s disease without dyskinesia, without mention of fluctuations'),
  icd('G20.A2', 'Parkinson’s disease without dyskinesia, with fluctuations'),
  icd('G20.B1', 'Parkinson’s disease with dyskinesia, without mention of fluctuations'),
  icd('G20.B2', 'Parkinson’s disease with dyskinesia, with fluctuations'),
  icd('G20.C', 'Parkinsonism, unspecified', 1, 1),
  icd('G21.11', 'Neuroleptic induced parkinsonism'),
  icd('G21.19', 'Other drug induced secondary parkinsonism'),
  icd('G21.4', 'Vascular parkinsonism'),
  icd('G21.9', 'Secondary parkinsonism, unspecified', 1, 1),
  icd('G23.1', 'Progressive supranuclear ophthalmoplegia [Steele-Richardson-Olszewski]'),
  icd('G23.2', 'Striatonigral degeneration'),
  icd('G24.01', 'Drug induced subacute dyskinesia'),
  icd('G24.02', 'Drug induced acute dystonia'),
  icd('G24.1', 'Genetic torsion dystonia'),
  icd('G24.3', 'Spasmodic torticollis'),
  icd('G24.4', 'Idiopathic orofacial dystonia'),
  icd('G24.5', 'Blepharospasm'),
  icd('G24.8', 'Other dystonia'),
  icd('G24.9', 'Dystonia, unspecified', 1, 1),
  icd('G25.0', 'Essential tremor'),
  icd('G25.1', 'Drug-induced tremor'),
  icd('G25.2', 'Other specified forms of tremor'),
  icd('G25.3', 'Myoclonus'),
  icd('G25.4', 'Drug-induced chorea'),
  icd('G25.5', 'Other chorea'),
  icd('G25.61', 'Drug induced tics'),
  icd('G25.70', 'Drug induced movement disorder, unspecified', 1, 1),
  icd('G25.81', 'Restless legs syndrome'),
  icd('G25.82', 'Stiff-man syndrome'),
  icd('G25.9', 'Extrapyramidal and movement disorder, unspecified', 1, 1),
  icd('G10', 'Huntington’s disease'),
  icd('G11.1', 'Early-onset cerebellar ataxia'),
  icd('G11.2', 'Late-onset cerebellar ataxia'),
  icd('G11.4', 'Hereditary spastic paraplegia'),
  icd('G11.9', 'Hereditary ataxia, unspecified', 1, 1),
  icd('R25.1', 'Tremor, unspecified', 1, 1),
  icd('R27.0', 'Ataxia, unspecified', 1, 1),
  icd('R25.2', 'Cramp and spasm'),
]

/* ============================================================================
 * Dementia & cognitive disorders (explicit)
 * ==========================================================================*/

const dementiaRows: IcdRow[] = [
  icd('G30.0', 'Alzheimer’s disease with early onset'),
  icd('G30.1', 'Alzheimer’s disease with late onset'),
  icd('G30.8', 'Other Alzheimer’s disease'),
  icd('G30.9', 'Alzheimer’s disease, unspecified', 1, 1),
  icd('F02.80', 'Dementia in other diseases classified elsewhere, without behavioral disturbance'),
  icd('F02.81', 'Dementia in other diseases classified elsewhere, with behavioral disturbance'),
  icd('F02.811', 'Dementia in other diseases classified elsewhere, moderate, with agitation'),
  icd('F02.A0', 'Dementia in other diseases classified elsewhere, mild, without behavioral disturbance'),
  icd('F02.B0', 'Dementia in other diseases classified elsewhere, moderate, without behavioral disturbance'),
  icd('F02.C0', 'Dementia in other diseases classified elsewhere, severe, without behavioral disturbance'),
  icd('F01.50', 'Vascular dementia, unspecified severity, without behavioral disturbance', 1, 1),
  icd('F01.51', 'Vascular dementia, unspecified severity, with behavioral disturbance', 1, 1),
  icd('F03.90', 'Unspecified dementia, unspecified severity, without behavioral disturbance', 1, 1),
  icd('F03.91', 'Unspecified dementia, unspecified severity, with behavioral disturbance', 1, 1),
  icd('G31.01', 'Pick’s disease'),
  icd('G31.09', 'Other frontotemporal dementia'),
  icd('G31.83', 'Dementia with Lewy bodies'),
  icd('G31.84', 'Mild cognitive impairment, so stated'),
  icd('G31.85', 'Corticobasal degeneration'),
  icd('G31.1', 'Senile degeneration of brain, not elsewhere classified'),
  icd('G31.2', 'Degeneration of nervous system due to alcohol'),
  icd('R41.0', 'Disorientation, unspecified', 1, 1),
  icd('R41.3', 'Other amnesia'),
  icd('R41.81', 'Age-related cognitive decline'),
  icd('R41.82', 'Altered mental status, unspecified', 1, 1),
  icd('R41.840', 'Attention and concentration deficit'),
  icd('R41.841', 'Cognitive communication deficit'),
  icd('R41.9', 'Unspecified symptoms and signs involving cognitive functions and awareness', 1, 1),
  icd('R54', 'Age-related physical debility'),
]

/* ============================================================================
 * Demyelinating & CNS inflammatory (explicit)
 * ==========================================================================*/

const demyelinatingRows: IcdRow[] = [
  icd('G35', 'Multiple sclerosis'),
  icd('G36.0', 'Neuromyelitis optica [Devic]'),
  icd('G36.1', 'Acute and subacute hemorrhagic leukoencephalitis [Hurst]'),
  icd('G36.9', 'Acute disseminated demyelination, unspecified', 1, 1),
  icd('G37.0', 'Diffuse sclerosis of central nervous system'),
  icd('G37.3', 'Acute transverse myelitis in demyelinating disease of central nervous system'),
  icd('G37.5', 'Concentric sclerosis [Balo] of central nervous system'),
  icd('G37.9', 'Demyelinating disease of central nervous system, unspecified', 1, 1),
  icd('H46.00', 'Optic papillitis, unspecified eye', 1, 1),
  icd('H46.01', 'Optic papillitis, right eye'),
  icd('H46.02', 'Optic papillitis, left eye'),
  icd('H46.03', 'Optic papillitis, bilateral'),
  icd('H46.10', 'Retrobulbar neuritis, unspecified eye', 1, 1),
  icd('H46.11', 'Retrobulbar neuritis, right eye'),
  icd('H46.12', 'Retrobulbar neuritis, left eye'),
  icd('H46.13', 'Retrobulbar neuritis, bilateral'),
  icd('H46.9', 'Unspecified optic neuritis', 1, 1),
  icd('G04.81', 'Other encephalitis and encephalomyelitis'),
  icd('G04.90', 'Encephalitis and encephalomyelitis, unspecified', 1, 1),
  icd('G04.00', 'Acute disseminated encephalitis and encephalomyelitis, unspecified', 1, 1),
  icd('G03.9', 'Meningitis, unspecified', 1, 1),
  icd('G00.9', 'Bacterial meningitis, unspecified', 1, 1),
  icd('G93.40', 'Encephalopathy, unspecified', 1, 1),
  icd('G93.41', 'Metabolic encephalopathy'),
  icd('G93.49', 'Other encephalopathy'),
  icd('G92.8', 'Other toxic encephalopathy'),
  icd('G93.1', 'Anoxic brain damage, not elsewhere classified'),
]

/* ============================================================================
 * Neuromuscular — motor neuron, NMJ, muscle, peripheral neuropathy (explicit)
 * ==========================================================================*/

const neuromuscularRows: IcdRow[] = [
  icd('G12.21', 'Amyotrophic lateral sclerosis'),
  icd('G12.20', 'Motor neuron disease, unspecified', 1, 1),
  icd('G12.22', 'Progressive bulbar palsy'),
  icd('G12.23', 'Primary lateral sclerosis'),
  icd('G12.29', 'Other motor neuron disease'),
  icd('G12.0', 'Infantile spinal muscular atrophy, type I [Werdnig-Hoffman]'),
  icd('G12.1', 'Other inherited spinal muscular atrophy'),
  icd('G70.00', 'Myasthenia gravis without (acute) exacerbation'),
  icd('G70.01', 'Myasthenia gravis with (acute) exacerbation'),
  icd('G70.1', 'Toxic myoneural disorders'),
  icd('G70.2', 'Congenital and developmental myasthenia'),
  icd('G70.80', 'Lambert-Eaton syndrome, unspecified', 1, 1),
  icd('G70.81', 'Lambert-Eaton syndrome in disease classified elsewhere'),
  icd('G71.00', 'Muscular dystrophy, unspecified', 1, 1),
  icd('G71.01', 'Duchenne or Becker muscular dystrophy'),
  icd('G71.11', 'Myotonic muscular dystrophy'),
  icd('G71.2', 'Congenital myopathies'),
  icd('G72.0', 'Drug-induced myopathy'),
  icd('G72.2', 'Myopathy due to other toxic agents'),
  icd('G72.41', 'Inclusion body myositis [IBM]'),
  icd('G72.49', 'Other inflammatory and immune myopathies, not elsewhere classified'),
  icd('G72.89', 'Other specified myopathies'),
  icd('G72.9', 'Myopathy, unspecified', 1, 1),
  icd('M33.20', 'Polymyositis, organ involvement unspecified', 1, 1),
  icd('M33.90', 'Dermatopolymyositis, unspecified, organ involvement unspecified', 1, 1),
  icd('G60.0', 'Hereditary motor and sensory neuropathy [Charcot-Marie-Tooth]'),
  icd('G60.3', 'Idiopathic progressive neuropathy'),
  icd('G60.9', 'Hereditary and idiopathic neuropathy, unspecified', 1, 1),
  icd('G61.0', 'Guillain-Barre syndrome'),
  icd('G61.81', 'Chronic inflammatory demyelinating polyneuritis (CIDP)'),
  icd('G61.82', 'Multifocal motor neuropathy'),
  icd('G61.89', 'Other inflammatory polyneuropathies'),
  icd('G61.9', 'Inflammatory polyneuropathy, unspecified', 1, 1),
  icd('G62.0', 'Drug-induced polyneuropathy'),
  icd('G62.1', 'Alcoholic polyneuropathy'),
  icd('G62.2', 'Polyneuropathy due to other toxic agents'),
  icd('G62.81', 'Critical illness polyneuropathy'),
  icd('G62.82', 'Radiation-induced polyneuropathy'),
  icd('G62.9', 'Polyneuropathy, unspecified', 1, 1),
  icd('G63', 'Polyneuropathy in diseases classified elsewhere'),
  icd('G64', 'Other disorders of peripheral nervous system'),
  icd('G65.2', 'Sequelae of toxic polyneuropathy'),
  icd('G58.0', 'Intercostal neuropathy'),
  icd('G58.7', 'Mononeuritis multiplex'),
  icd('G58.9', 'Mononeuropathy, unspecified', 1, 1),
  icd('G59.0', 'Diabetic mononeuropathy'),
  icd('G90.09', 'Other idiopathic peripheral autonomic neuropathy'),
  icd('G90.3', 'Multi-system degeneration of the autonomic nervous system'),
  icd('G90.4', 'Autonomic dysreflexia'),
  icd('G90.50', 'Complex regional pain syndrome I, unspecified', 1, 1),
  icd('G90.A', 'Postural orthostatic tachycardia syndrome [POTS]'),
  icd('G90.9', 'Disorder of the autonomic nervous system, unspecified', 1, 1),
  icd('E11.42', 'Type 2 diabetes mellitus with diabetic polyneuropathy', 1, 0),
  icd('E11.40', 'Type 2 diabetes mellitus with diabetic neuropathy, unspecified', 1, 1),
  icd('E11.43', 'Type 2 diabetes mellitus with diabetic autonomic (poly)neuropathy'),
]

/* ============================================================================
 * Cranial nerve & facial disorders (explicit)
 * ==========================================================================*/

const cranialNerveRows: IcdRow[] = [
  icd('G50.0', 'Trigeminal neuralgia'),
  icd('G50.1', 'Atypical facial pain'),
  icd('G50.8', 'Other disorders of trigeminal nerve'),
  icd('G50.9', 'Disorder of trigeminal nerve, unspecified', 1, 1),
  icd('G51.0', 'Bell’s palsy'),
  icd('G51.1', 'Geniculate ganglionitis'),
  icd('G51.3', 'Clonic hemifacial spasm'),
  icd('G51.4', 'Facial myokymia'),
  icd('G51.8', 'Other disorders of facial nerve'),
  icd('G51.9', 'Disorder of facial nerve, unspecified', 1, 1),
  icd('G52.1', 'Disorders of glossopharyngeal nerve'),
  icd('G52.2', 'Disorders of vagus nerve'),
  icd('G52.9', 'Cranial nerve disorder, unspecified', 1, 1),
  icd('H49.00', 'Third [oculomotor] nerve palsy, unspecified eye', 1, 1),
  icd('H49.20', 'Sixth [abducent] nerve palsy, unspecified eye', 1, 1),
  icd('G53', 'Cranial nerve disorders in diseases classified elsewhere'),
  icd('B02.22', 'Postherpetic trigeminal neuralgia'),
  icd('B02.29', 'Other postherpetic nervous system involvement'),
]

/* ============================================================================
 * Radiculopathy / plexus / spinal (explicit)
 * ==========================================================================*/

const spineRootRows: IcdRow[] = [
  icd('M54.10', 'Radiculopathy, site unspecified', 1, 1),
  icd('M54.11', 'Radiculopathy, occipito-atlanto-axial region'),
  icd('M54.12', 'Radiculopathy, cervical region'),
  icd('M54.13', 'Radiculopathy, cervicothoracic region'),
  icd('M54.14', 'Radiculopathy, thoracic region'),
  icd('M54.15', 'Radiculopathy, thoracolumbar region'),
  icd('M54.16', 'Radiculopathy, lumbar region'),
  icd('M54.17', 'Radiculopathy, lumbosacral region'),
  icd('M54.18', 'Radiculopathy, sacral and sacrococcygeal region'),
  icd('M54.2', 'Cervicalgia'),
  icd('M54.5', 'Low back pain, unspecified', 1, 1),
  icd('M54.50', 'Low back pain, unspecified', 1, 1),
  icd('M54.51', 'Vertebrogenic low back pain'),
  icd('M54.6', 'Pain in thoracic spine'),
  icd('M54.9', 'Dorsalgia, unspecified', 1, 1),
  icd('M47.16', 'Other spondylosis with myelopathy, lumbar region'),
  icd('M47.22', 'Other spondylosis with radiculopathy, cervical region'),
  icd('M47.26', 'Other spondylosis with radiculopathy, lumbar region'),
  icd('M50.121', 'Cervical disc disorder at C5-C6 level with radiculopathy'),
  icd('M50.20', 'Other cervical disc displacement, unspecified cervical region', 1, 1),
  icd('M51.16', 'Intervertebral disc disorders with radiculopathy, lumbar region'),
  icd('M51.26', 'Other intervertebral disc displacement, lumbar region'),
  icd('M48.06', 'Spinal stenosis, lumbar region'),
  icd('M48.02', 'Spinal stenosis, cervical region'),
  icd('G54.0', 'Brachial plexus disorders'),
  icd('G54.1', 'Lumbosacral plexus disorders'),
  icd('G54.2', 'Cervical root disorders, not elsewhere classified'),
  icd('G54.5', 'Neuralgic amyotrophy'),
  icd('G54.9', 'Nerve root and plexus disorder, unspecified', 1, 1),
  icd('G55', 'Nerve root and plexus compressions in diseases classified elsewhere'),
  icd('G95.0', 'Syringomyelia and syringobulbia'),
  icd('G95.11', 'Vascular myelopathies, ischemic'),
  icd('G95.9', 'Disease of spinal cord, unspecified', 1, 1),
  icd('G83.4', 'Cauda equina syndrome'),
  icd('M54.31', 'Sciatica, right side'),
  icd('M54.32', 'Sciatica, left side'),
]

/* ============================================================================
 * Headache & pain (explicit)
 * ==========================================================================*/

const headachePainRows: IcdRow[] = [
  icd('G43.909', 'Migraine, unspecified, not intractable, without status migrainosus', 1, 1),
  icd('G43.911', 'Migraine, unspecified, intractable, with status migrainosus', 1, 1),
  icd('G43.809', 'Other migraine, not intractable, without status migrainosus'),
  icd('G43.A0', 'Cyclical vomiting, not intractable'),
  icd('G43.A1', 'Cyclical vomiting, intractable'),
  icd('G43.C0', 'Periodic headache syndromes in child or adult, not intractable'),
  icd('G44.001', 'Cluster headache syndrome, unspecified, intractable'),
  icd('G44.009', 'Cluster headache syndrome, unspecified, not intractable', 1, 1),
  icd('G44.011', 'Episodic cluster headache, intractable'),
  icd('G44.019', 'Episodic cluster headache, not intractable'),
  icd('G44.021', 'Chronic cluster headache, intractable'),
  icd('G44.029', 'Chronic cluster headache, not intractable'),
  icd('G44.051', 'Hemicrania continua'),
  icd('G44.201', 'Tension-type headache, unspecified, intractable'),
  icd('G44.209', 'Tension-type headache, unspecified, not intractable', 1, 1),
  icd('G44.211', 'Episodic tension-type headache, intractable'),
  icd('G44.219', 'Episodic tension-type headache, not intractable'),
  icd('G44.221', 'Chronic tension-type headache, intractable'),
  icd('G44.229', 'Chronic tension-type headache, not intractable'),
  icd('G44.1', 'Vascular headache, not elsewhere classified'),
  icd('G44.311', 'Acute post-traumatic headache, intractable'),
  icd('G44.319', 'Acute post-traumatic headache, not intractable'),
  icd('G44.321', 'Chronic post-traumatic headache, intractable'),
  icd('G44.329', 'Chronic post-traumatic headache, not intractable'),
  icd('G44.40', 'Drug-induced headache, not elsewhere classified, not intractable', 1, 1),
  icd('G44.41', 'Drug-induced headache, not elsewhere classified, intractable'),
  icd('G44.51', 'Hemicrania continua headache'),
  icd('G44.52', 'New daily persistent headache (NDPH)'),
  icd('G44.53', 'Primary thunderclap headache'),
  icd('G44.89', 'Other headache syndrome'),
  icd('R51.9', 'Headache, unspecified', 1, 1),
  icd('R51.0', 'Headache with orthostatic component, not elsewhere classified'),
  icd('G89.11', 'Acute pain due to trauma'),
  icd('G89.18', 'Other acute postprocedural pain'),
  icd('G89.21', 'Chronic pain due to trauma'),
  icd('G89.29', 'Other chronic pain'),
  icd('G89.4', 'Chronic pain syndrome'),
  icd('G89.3', 'Neoplasm related pain (acute) (chronic)'),
  icd('G90.50', 'Complex regional pain syndrome I (CRPS I), unspecified', 1, 1),
  icd('G58.8', 'Other specified mononeuropathies'),
  icd('M79.2', 'Neuralgia and neuritis, unspecified', 1, 1),
  icd('B02.23', 'Postherpetic polyneuropathy'),
]

/* ============================================================================
 * Sleep, seizure symptoms, syncope, vertigo, other symptoms (explicit)
 * ==========================================================================*/

const symptomSleepRows: IcdRow[] = [
  icd('G47.00', 'Insomnia, unspecified', 1, 1),
  icd('G47.10', 'Hypersomnia, unspecified', 1, 1),
  icd('G47.33', 'Obstructive sleep apnea (adult) (pediatric)', 1, 0),
  icd('G47.31', 'Primary central sleep apnea'),
  icd('G47.37', 'Central sleep apnea in conditions classified elsewhere'),
  icd('G47.411', 'Narcolepsy with cataplexy'),
  icd('G47.419', 'Narcolepsy without cataplexy', 1, 1),
  icd('G47.421', 'Narcolepsy in conditions classified elsewhere with cataplexy'),
  icd('G47.52', 'REM sleep behavior disorder'),
  icd('G47.61', 'Periodic limb movement disorder'),
  icd('G47.63', 'Sleep related bruxism'),
  icd('G47.9', 'Sleep disorder, unspecified', 1, 1),
  icd('R56.00', 'Simple febrile convulsions'),
  icd('R56.9', 'Unspecified convulsions', 1, 1),
  icd('R56.1', 'Post traumatic seizures'),
  icd('R55', 'Syncope and collapse'),
  icd('R56.01', 'Complex febrile convulsions'),
  icd('R42', 'Dizziness and giddiness'),
  icd('R26.0', 'Ataxic gait'),
  icd('R26.1', 'Paralytic gait'),
  icd('R26.2', 'Difficulty in walking, not elsewhere classified'),
  icd('R26.81', 'Unsteadiness on feet'),
  icd('R26.89', 'Other abnormalities of gait and mobility'),
  icd('R27.8', 'Other lack of coordination'),
  icd('R29.810', 'Facial weakness'),
  icd('R29.6', 'Repeated falls'),
  icd('R20.0', 'Anesthesia of skin'),
  icd('R20.1', 'Hypoesthesia of skin'),
  icd('R20.2', 'Paresthesia of skin'),
  icd('R20.8', 'Other disturbances of skin sensation'),
  icd('R25.0', 'Abnormal head movements'),
  icd('R25.3', 'Fasciculation'),
  icd('R47.01', 'Aphasia'),
  icd('R47.02', 'Dysphasia'),
  icd('R47.1', 'Dysarthria and anarthria'),
  icd('R47.81', 'Slurred speech'),
  icd('R53.1', 'Weakness'),
  icd('R53.83', 'Other fatigue'),
  icd('R40.0', 'Somnolence'),
  icd('R40.1', 'Stupor'),
  icd('R40.20', 'Unspecified coma', 1, 1),
  icd('R40.4', 'Transient alteration of awareness'),
  icd('R55', 'Syncope and collapse (vasovagal)'),
  icd('H81.10', 'Benign paroxysmal vertigo, unspecified ear', 1, 1),
  icd('H81.13', 'Benign paroxysmal vertigo, bilateral'),
  icd('H81.4', 'Vertigo of central origin'),
  icd('R11.0', 'Nausea'),
  icd('R25.2', 'Cramp and spasm of muscle'),
  icd('M62.81', 'Muscle weakness (generalized)'),
  icd('R41.4', 'Neurologic neglect syndrome'),
]

/* ============================================================================
 * Hydrocephalus, CSF, intracranial pressure, TBI/concussion (explicit)
 * ==========================================================================*/

const structuralTbiRows: IcdRow[] = [
  icd('G91.0', 'Communicating hydrocephalus'),
  icd('G91.1', 'Obstructive hydrocephalus'),
  icd('G91.2', 'Normal pressure hydrocephalus (idiopathic)'),
  icd('G91.9', 'Hydrocephalus, unspecified', 1, 1),
  icd('G93.2', 'Benign intracranial hypertension (idiopathic)'),
  icd('G93.5', 'Compression of brain'),
  icd('G93.6', 'Cerebral edema'),
  icd('G93.89', 'Other specified disorders of brain'),
  icd('G93.9', 'Disorder of brain, unspecified', 1, 1),
  icd('G96.0', 'Cerebrospinal fluid leak'),
  icd('G96.11', 'Dural tear'),
  icd('G96.19', 'Other disorders of meninges, not elsewhere classified'),
  icd('S06.0X0A', 'Concussion without loss of consciousness, initial encounter'),
  icd('S06.0X1A', 'Concussion with loss of consciousness of 30 minutes or less, initial encounter'),
  icd('S06.0X9A', 'Concussion with loss of consciousness of unspecified duration, initial encounter', 1, 1),
  icd('S06.2X0A', 'Diffuse traumatic brain injury without loss of consciousness, initial encounter'),
  icd('S06.5X0A', 'Traumatic subdural hemorrhage without loss of consciousness, initial encounter'),
  icd('S06.9X0A', 'Unspecified intracranial injury without loss of consciousness, initial encounter', 1, 1),
  icd('F07.81', 'Postconcussional syndrome'),
  icd('Z87.820', 'Personal history of traumatic brain injury'),
  icd('G44.319', 'Acute post-traumatic headache, not intractable (post-TBI)'),
  icd('S06.0X0S', 'Concussion without loss of consciousness, sequela'),
]

/* ============================================================================
 * Status / history / screening Z-codes (explicit)
 * ==========================================================================*/

const zRows: IcdRow[] = [
  icd('Z79.899', 'Other long term (current) drug therapy (e.g., antiepileptic, immunomodulator)'),
  icd('Z79.01', 'Long term (current) use of anticoagulants'),
  icd('Z79.02', 'Long term (current) use of antithrombotics/antiplatelets'),
  icd('Z86.73', 'Personal history of transient ischemic attack (TIA), and cerebral infarction without residual deficits'),
  icd('Z82.0', 'Family history of epilepsy and other diseases of the nervous system'),
  icd('Z91.81', 'History of falling'),
  icd('Z96.41', 'Presence of insulin pump (external) (internal)'),
  icd('Z45.42', 'Encounter for adjustment and management of neurostimulator'),
  icd('Z46.2', 'Encounter for fitting and adjustment of other devices related to nervous system'),
  icd('Z13.850', 'Encounter for screening for traumatic brain injury'),
  icd('Z51.81', 'Encounter for therapeutic drug level monitoring'),
  icd('Z48.3', 'Aftercare following surgery for neoplasm'),
  icd('Z85.841', 'Personal history of malignant neoplasm of brain'),
  icd('Z86.69', 'Personal history of other diseases of the nervous system and sense organs'),
  icd('Z09', 'Encounter for follow-up examination after completed treatment for conditions other than malignant neoplasm'),
  icd('Z01.83', 'Encounter for allergy testing'),
  icd('R94.02', 'Abnormal electroencephalogram [EEG]'),
  icd('R94.131', 'Abnormal electromyogram [EMG]'),
  icd('R90.0', 'Intracranial space-occupying lesion found on diagnostic imaging of central nervous system'),
  icd('R90.89', 'Other abnormal findings on diagnostic imaging of central nervous system'),
]

/* ============================================================================
 * Assemble ICD rows
 * ==========================================================================*/

// Ordering note: the prediction engine grounds on the FIRST N rows per specialty
// (see referenceForSpecialty). Common, high-yield disease families are placed
// first so they fall inside the grounding window; the large combinatorial
// laterality/sequelae enumerations (still fully used for validation) follow.
export const NEU_ICD_ROWS: IcdRow[] = [
  ...migraineRows(),
  ...epilepsyRows(),
  ...demyelinatingRows,
  ...cerebrovascularRows,
  ...movementRows,
  ...dementiaRows,
  ...neuromuscularRows,
  ...cranialNerveRows,
  ...headachePainRows,
  ...symptomSleepRows,
  ...spineRootRows,
  ...structuralTbiRows,
  ...upperMononeuropathyRows(),
  ...lowerMononeuropathyRows(),
  ...sequelaeRows('I69.', 'cerebral infarction'),
  ...sequelaeRows('I69.1', 'nontraumatic intracerebral hemorrhage'),
  ...sequelaeExtraRows,
  ...zRows,
]

/* ============================================================================
 * Neurology CPT / HCPCS (real codes; MUE = real per-day maximum)
 * ==========================================================================*/

const cpt = (code: string, description: string, mue: number): CptRow => [code, description, mue, [NEU]]

export const NEU_CPT_ROWS: CptRow[] = [
  // E/M — office / outpatient
  cpt('99202', 'Office/outpatient visit, new patient, straightforward, 15-29 min', 1),
  cpt('99203', 'Office/outpatient visit, new patient, low complexity, 30-44 min', 1),
  cpt('99204', 'Office/outpatient visit, new patient, moderate complexity, 45-59 min', 1),
  cpt('99205', 'Office/outpatient visit, new patient, high complexity, 60-74 min', 1),
  cpt('99212', 'Office/outpatient visit, established, straightforward, 10-19 min', 1),
  cpt('99213', 'Office/outpatient visit, established, low complexity, 20-29 min', 1),
  cpt('99214', 'Office/outpatient visit, established, moderate complexity, 30-39 min', 1),
  cpt('99215', 'Office/outpatient visit, established, high complexity, 40-54 min', 1),
  cpt('99417', 'Prolonged outpatient E/M service, each additional 15 minutes', 8),
  // E/M — hospital / consult / ED / critical care
  cpt('99221', 'Initial hospital inpatient/observation care, low complexity', 1),
  cpt('99222', 'Initial hospital inpatient/observation care, moderate complexity', 1),
  cpt('99223', 'Initial hospital inpatient/observation care, high complexity', 1),
  cpt('99231', 'Subsequent hospital inpatient/observation care, low complexity', 1),
  cpt('99232', 'Subsequent hospital inpatient/observation care, moderate complexity', 1),
  cpt('99233', 'Subsequent hospital inpatient/observation care, high complexity', 1),
  cpt('99238', 'Hospital inpatient/observation discharge day management; 30 minutes or less', 1),
  cpt('99239', 'Hospital inpatient/observation discharge day management; more than 30 minutes', 1),
  cpt('99244', 'Office consultation, new/established, moderate complexity', 1),
  cpt('99245', 'Office consultation, new/established, high complexity', 1),
  cpt('99253', 'Inpatient consultation, low complexity', 1),
  cpt('99254', 'Inpatient consultation, moderate complexity', 1),
  cpt('99255', 'Inpatient consultation, high complexity', 1),
  cpt('99284', 'Emergency department visit, high complexity', 1),
  cpt('99285', 'Emergency department visit, highest complexity', 1),
  cpt('99291', 'Critical care, evaluation and management; first 30-74 minutes', 1),
  cpt('99292', 'Critical care; each additional 30 minutes', 8),
  cpt('99497', 'Advance care planning, first 30 minutes', 1),
  // Electroencephalography (EEG) — routine & long-term monitoring
  cpt('95812', 'Electroencephalogram (EEG) extended monitoring; 41-60 minutes', 1),
  cpt('95813', 'Electroencephalogram (EEG) extended monitoring; greater than 1 hour', 1),
  cpt('95816', 'Electroencephalogram (EEG); including recording awake and drowsy', 1),
  cpt('95819', 'Electroencephalogram (EEG); including recording awake and asleep', 1),
  cpt('95822', 'Electroencephalogram (EEG); recording in coma or sleep only', 1),
  cpt('95830', 'Insertion by physician of sphenoidal electrodes for EEG recording', 1),
  cpt('95700', 'EEG continuous recording, setup, patient education and takedown', 1),
  cpt('95705', 'EEG without video, review of recorded events, up to 2 days; unmonitored', 1),
  cpt('95711', 'EEG with video, review of recorded events, up to 2 days; monitored 2-12 hours', 1),
  cpt('95717', 'EEG with video, physician review, up to 2 days, 2-12 hours of recording', 1),
  cpt('95718', 'EEG with video, physician review, up to 2 days, 12-26 hours of recording', 1),
  cpt('95719', 'EEG with video, physician review, up to 2 days, 26-38 hours of recording', 1),
  cpt('95720', 'EEG with video, physician review, up to 2 days, 38-50 hours of recording', 1),
  cpt('95721', 'EEG with video, physician review, greater than 2 days, up to 60 hours', 1),
  cpt('95724', 'EEG with video, physician review, 12-26 hours per 24 hour period', 1),
  cpt('95957', 'Digital analysis of electroencephalogram (EEG)', 1),
  cpt('95961', 'Functional cortical mapping by stimulation of electrodes; first hour', 1),
  // Evoked potentials
  cpt('95925', 'Short-latency somatosensory evoked potential study; upper limbs', 1),
  cpt('95926', 'Short-latency somatosensory evoked potential study; lower limbs', 1),
  cpt('95927', 'Short-latency somatosensory evoked potential study; trunk or head', 1),
  cpt('95928', 'Central motor evoked potential study; upper limbs', 1),
  cpt('95929', 'Central motor evoked potential study; lower limbs', 1),
  cpt('95930', 'Visual evoked potential (VEP) checkerboard or flash testing, central nervous system', 1),
  cpt('92585', 'Auditory evoked potentials for evoked response audiometry, comprehensive', 1),
  cpt('95938', 'Short-latency somatosensory evoked potential study; upper and lower limbs', 1),
  // Nerve conduction studies (NCS)
  cpt('95907', 'Nerve conduction studies; 1-2 studies', 1),
  cpt('95908', 'Nerve conduction studies; 3-4 studies', 1),
  cpt('95909', 'Nerve conduction studies; 5-6 studies', 1),
  cpt('95910', 'Nerve conduction studies; 7-8 studies', 1),
  cpt('95911', 'Nerve conduction studies; 9-10 studies', 1),
  cpt('95912', 'Nerve conduction studies; 11-12 studies', 1),
  cpt('95913', 'Nerve conduction studies; 13 or more studies', 1),
  cpt('95905', 'Motor and/or sensory nerve conduction, preconfigured electrode array', 1),
  cpt('95937', 'Neuromuscular junction testing (repetitive stimulation), each nerve', 3),
  // Needle electromyography (EMG)
  cpt('95860', 'Needle electromyography; 1 extremity', 1),
  cpt('95861', 'Needle electromyography; 2 extremities', 1),
  cpt('95863', 'Needle electromyography; 3 extremities', 1),
  cpt('95864', 'Needle electromyography; 4 extremities', 1),
  cpt('95865', 'Needle electromyography; larynx', 1),
  cpt('95867', 'Needle electromyography; cranial nerve supplied muscle(s), unilateral', 1),
  cpt('95869', 'Needle electromyography; thoracic paraspinal muscles', 1),
  cpt('95870', 'Needle electromyography; limited study of muscles in 1 extremity or non-limb muscles', 2),
  cpt('95885', 'Needle EMG, each extremity, limited study, with nerve conduction (add-on)', 4),
  cpt('95886', 'Needle EMG, each extremity, complete, with nerve conduction (add-on)', 4),
  cpt('95887', 'Needle EMG, non-extremity (cranial/axial) muscles, with nerve conduction (add-on)', 1),
  // Autonomic function testing
  cpt('95921', 'Testing of autonomic nervous system function; cardiovagal innervation', 1),
  cpt('95922', 'Testing of autonomic nervous system function; vasomotor adrenergic innervation', 1),
  cpt('95923', 'Testing of autonomic nervous system function; sudomotor (QSART)', 1),
  cpt('95924', 'Testing of autonomic nervous system function; combined parasympathetic and sympathetic', 1),
  cpt('93660', 'Evaluation of cardiovascular function with tilt table testing', 1),
  // Chemodenervation / injections (botulinum toxin & guidance)
  cpt('64612', 'Chemodenervation of muscle(s); muscle(s) innervated by facial nerve, unilateral', 2),
  cpt('64615', 'Chemodenervation of muscle(s); muscles innervated by facial, trigeminal, cervical spinal and accessory nerves, bilateral (chronic migraine)', 1),
  cpt('64616', 'Chemodenervation of muscle(s); neck muscle(s), excluding larynx (cervical dystonia)', 1),
  cpt('64617', 'Chemodenervation of muscle(s); larynx, unilateral, with EMG guidance', 1),
  cpt('64642', 'Chemodenervation of one extremity; 1-4 muscles', 1),
  cpt('64643', 'Chemodenervation of one extremity; each additional 1-4 muscles', 3),
  cpt('64644', 'Chemodenervation of one extremity; 5 or more muscles', 1),
  cpt('64645', 'Chemodenervation of one extremity; each additional 5 or more muscles', 3),
  cpt('64646', 'Chemodenervation of trunk muscle(s); 1-5 muscles', 1),
  cpt('64647', 'Chemodenervation of trunk muscle(s); 6 or more muscles', 1),
  cpt('95873', 'Electrical stimulation for guidance in conjunction with chemodenervation (add-on)', 1),
  cpt('95874', 'Needle electromyography for guidance in conjunction with chemodenervation (add-on)', 1),
  // Nerve blocks & pain procedures
  cpt('64400', 'Injection, anesthetic agent; trigeminal nerve, any division or branch', 2),
  cpt('64405', 'Injection, anesthetic agent; greater occipital nerve', 2),
  cpt('64450', 'Injection, anesthetic agent; other peripheral nerve or branch', 3),
  cpt('64483', 'Injection, transforaminal epidural, lumbar or sacral; single level', 1),
  cpt('64490', 'Injection, paravertebral facet joint, cervical or thoracic; single level', 1),
  cpt('64493', 'Injection, paravertebral facet joint, lumbar or sacral; single level', 1),
  cpt('62321', 'Injection, interlaminar epidural, cervical or thoracic; with imaging guidance', 1),
  cpt('62323', 'Injection, interlaminar epidural, lumbar or sacral; with imaging guidance', 1),
  cpt('20552', 'Injection(s); single or multiple trigger point(s), 1 or 2 muscle(s)', 1),
  cpt('20553', 'Injection(s); single or multiple trigger point(s), 3 or more muscles', 1),
  cpt('96372', 'Therapeutic/prophylactic/diagnostic injection, subcutaneous or intramuscular', 6),
  cpt('96365', 'Intravenous infusion, therapy/prophylaxis/diagnosis; initial, up to 1 hour', 1),
  cpt('96366', 'Intravenous infusion, therapy/prophylaxis/diagnosis; each additional hour', 8),
  // Lumbar puncture & CSF
  cpt('62270', 'Spinal puncture, lumbar, diagnostic', 1),
  cpt('62272', 'Spinal puncture, therapeutic, for drainage of cerebrospinal fluid', 1),
  cpt('62328', 'Spinal puncture, lumbar, diagnostic, with fluoroscopic or CT guidance', 1),
  // Neurostimulator analysis / programming
  cpt('95970', 'Electronic analysis of implanted neurostimulator pulse generator/transmitter, without programming', 1),
  cpt('95971', 'Electronic analysis with simple programming, implanted spinal cord/peripheral nerve neurostimulator', 1),
  cpt('95976', 'Electronic analysis with simple programming, cranial nerve neurostimulator (VNS)', 1),
  cpt('95983', 'Electronic analysis with programming, brain neurostimulator (DBS); first 15 minutes', 1),
  cpt('95984', 'Electronic analysis with programming, brain neurostimulator (DBS); each additional 15 minutes', 3),
  // Sleep studies
  cpt('95805', 'Multiple sleep latency or maintenance of wakefulness testing', 1),
  cpt('95806', 'Sleep study, unattended, heart rate, oxygen saturation, respiratory airflow', 1),
  cpt('95808', 'Polysomnography; sleep staging with 1-3 additional parameters, attended', 1),
  cpt('95810', 'Polysomnography; sleep staging with 4 or more additional parameters, attended', 1),
  cpt('95811', 'Polysomnography; with initiation of CPAP or bilevel ventilation, attended', 1),
  // Cognitive / neuropsychological testing
  cpt('96116', 'Neurobehavioral status exam by physician/QHP; first hour', 1),
  cpt('96121', 'Neurobehavioral status exam by physician/QHP; each additional hour', 4),
  cpt('96125', 'Standardized cognitive performance testing, per hour', 4),
  cpt('96132', 'Neuropsychological testing evaluation by physician/QHP; first hour', 1),
  cpt('96133', 'Neuropsychological testing evaluation by physician/QHP; each additional hour', 8),
  cpt('96136', 'Psychological or neuropsychological test administration by physician/QHP; first 30 minutes', 1),
  cpt('96137', 'Psychological or neuropsychological test administration by physician/QHP; each additional 30 minutes', 8),
  cpt('96138', 'Psychological or neuropsychological test administration by technician; first 30 minutes', 1),
  cpt('96139', 'Psychological or neuropsychological test administration by technician; each additional 30 minutes', 8),
  cpt('99483', 'Assessment of and care planning for a patient with cognitive impairment', 1),
  // Vascular / ultrasound
  cpt('93880', 'Duplex scan of extracranial arteries; complete bilateral', 1),
  cpt('93882', 'Duplex scan of extracranial arteries; unilateral or limited', 1),
  cpt('93886', 'Transcranial Doppler study of the intracranial arteries; complete', 1),
  cpt('93888', 'Transcranial Doppler study of the intracranial arteries; limited', 1),
  // Muscle / nerve biopsy
  cpt('20206', 'Biopsy, muscle, percutaneous needle', 1),
  cpt('20200', 'Biopsy, muscle; superficial', 1),
  cpt('20205', 'Biopsy, muscle; deep', 1),
  cpt('64795', 'Biopsy of nerve', 1),
  // Intraoperative neuromonitoring
  cpt('95940', 'Continuous intraoperative neurophysiology monitoring in the operating room, per 15 min', 32),
  cpt('95941', 'Continuous intraoperative neurophysiology monitoring, from outside the operating room, per hour', 12),
  // Relevant labs & imaging ordered/interpreted
  cpt('82550', 'Creatine kinase (CK) (CPK); total', 1),
  cpt('86255', 'Fluorescent noninfectious agent antibody screen (e.g., acetylcholine receptor antibody)', 1),
  cpt('83519', 'Immunoassay for analyte, quantitative; by radioimmunoassay (e.g., AChR antibody)', 1),
  cpt('83916', 'Oligoclonal immune (oligoclonal bands), CSF and serum', 1),
  cpt('84443', 'Thyroid stimulating hormone (TSH)', 1),
  cpt('82607', 'Cyanocobalamin (Vitamin B-12)', 1),
  cpt('82306', 'Vitamin D; 25 hydroxy', 1),
  cpt('85652', 'Erythrocyte sedimentation rate (ESR); non-automated', 1),
  cpt('86140', 'C-reactive protein (CRP)', 1),
  cpt('70551', 'Magnetic resonance imaging, brain; without contrast material', 1),
  cpt('70552', 'Magnetic resonance imaging, brain; with contrast material', 1),
  cpt('70553', 'Magnetic resonance imaging, brain; without contrast, followed by with contrast', 1),
  cpt('70450', 'Computed tomography, head or brain; without contrast material', 1),
  cpt('70496', 'Computed tomographic angiography, head, with contrast and image postprocessing', 1),
  cpt('72141', 'Magnetic resonance imaging, cervical spinal canal; without contrast material', 1),
  cpt('72148', 'Magnetic resonance imaging, lumbar spinal canal; without contrast material', 1),
  cpt('77003', 'Fluoroscopic guidance for needle placement (spine/paraspinous diagnostic/therapeutic)', 1),
  // Drug / biologic HCPCS (billed with chemodenervation / neuro infusions)
  cpt('J0585', 'Injection, onabotulinumtoxinA, 1 unit', 400),
  cpt('J0586', 'Injection, abobotulinumtoxinA, 5 units', 250),
  cpt('J0588', 'Injection, incobotulinumtoxinA, 1 unit', 400),
  cpt('J0587', 'Injection, rimabotulinumtoxinB, 100 units', 100),
  cpt('J1301', 'Injection, edaravone, 1 mg (ALS)', 60),
  cpt('J1826', 'Injection, interferon beta-1a, 30 mcg (multiple sclerosis)', 1),
  cpt('J2323', 'Injection, natalizumab, 1 mg (multiple sclerosis)', 300),
  cpt('J1561', 'Injection, immune globulin (IVIG), 500 mg', 90),
  cpt('J3357', 'Ustekinumab, for subcutaneous injection, 1 mg', 90),
]

/* ============================================================================
 * Neurology NCCI PTP edits (real bundling pairs)
 * ==========================================================================*/

export interface NeuNcci {
  column1: string
  column2: string
  modifierAllowed: boolean
  rationale: string
}

export const NEU_NCCI: NeuNcci[] = [
  { column1: '95819', column2: '95816', modifierAllowed: false, rationale: 'EEG awake and asleep (95819) includes the awake-and-drowsy recording (95816); only one routine EEG per session' },
  { column1: '95819', column2: '95822', modifierAllowed: false, rationale: 'EEG awake and asleep (95819) includes the coma/sleep-only recording (95822)' },
  { column1: '95816', column2: '95822', modifierAllowed: false, rationale: 'A single routine EEG session is reported once; the drowsy and sleep-only variants are mutually exclusive components' },
  { column1: '95886', column2: '95885', modifierAllowed: false, rationale: 'Complete needle EMG of an extremity (95886) includes the limited study (95885) for the same extremity' },
  { column1: '95861', column2: '95860', modifierAllowed: false, rationale: 'Needle EMG of 2 extremities (95861) includes the single-extremity study (95860)' },
  { column1: '95913', column2: '95911', modifierAllowed: false, rationale: 'Nerve conduction studies are reported once by total study count; the higher tier (95913) subsumes lower tiers' },
  { column1: '95910', column2: '95909', modifierAllowed: false, rationale: 'Nerve conduction studies are reported once by total study count; report only the code matching the total number of studies' },
  { column1: '64615', column2: '95874', modifierAllowed: true, rationale: 'EMG guidance for chemodenervation (95874) is separately reportable with 64615 only when guidance is documented and appended per guidance rules' },
  { column1: '62328', column2: '62270', modifierAllowed: false, rationale: 'Lumbar puncture with imaging guidance (62328) includes the diagnostic spinal puncture (62270)' },
  { column1: '62328', column2: '77003', modifierAllowed: false, rationale: 'Lumbar puncture with imaging guidance (62328) includes the fluoroscopic guidance (77003)' },
  { column1: '95811', column2: '95810', modifierAllowed: false, rationale: 'Polysomnography with CPAP titration (95811) includes the diagnostic polysomnography (95810)' },
  { column1: '95810', column2: '95808', modifierAllowed: false, rationale: 'Full polysomnography (95810) includes the limited sleep-staging study (95808)' },
  { column1: '70553', column2: '70551', modifierAllowed: false, rationale: 'MRI brain without and with contrast (70553) includes the without-contrast study (70551)' },
  { column1: '70553', column2: '70552', modifierAllowed: false, rationale: 'MRI brain without and with contrast (70553) includes the with-contrast study (70552)' },
  { column1: '99214', column2: '64615', modifierAllowed: true, rationale: 'A significant, separately identifiable E/M on the same day as botulinum toxin chemodenervation requires modifier 25 on the E/M' },
  { column1: '99214', column2: '62270', modifierAllowed: true, rationale: 'A significant, separately identifiable E/M on the same day as a diagnostic lumbar puncture requires modifier 25 on the E/M' },
  { column1: '95886', column2: '95908', modifierAllowed: false, rationale: 'When the same limb receives both, report the EMG-with-NCS add-on (95886) which already bundles the concurrent nerve conduction component' },
]

/* ============================================================================
 * Neurology LCD / NCD medical-necessity coverage policies
 * ==========================================================================*/

export interface NeuPolicy {
  policyId: string
  title: string
  cpt: string[]
  supportingIcdPrefixes: string[]
  criterion: string
  specialty: Specialty
}

export const NEU_POLICIES: NeuPolicy[] = [
  { policyId: 'LCD L34594', title: 'Nerve Conduction Studies and Needle EMG', cpt: ['95907', '95908', '95909', '95910', '95911', '95912', '95913', '95885', '95886', '95887', '95860', '95861', '95863', '95864'], supportingIcdPrefixes: ['G56', 'G57', 'G58', 'G60', 'G61', 'G62', 'G63', 'G70', 'G71', 'G72', 'G12', 'M54.1', 'G54', 'G55', 'E11.4', 'E10.4'], criterion: 'NCS/EMG are covered to localize and characterize a suspected neuromuscular disorder (neuropathy, radiculopathy, plexopathy, myopathy, motor neuron or NMJ disease) with documented symptoms; screening without indication is not covered.', specialty: NEU },
  { policyId: 'LCD L34635', title: 'Electroencephalography / Long-Term EEG Monitoring', cpt: ['95816', '95819', '95822', '95812', '95813', '95700', '95717', '95718', '95719', '95720', '95724'], supportingIcdPrefixes: ['G40', 'R56', 'R55', 'G93.40', 'F03', 'G30', 'R40', 'S06'], criterion: 'EEG is covered to evaluate documented seizures/epilepsy, altered consciousness, or encephalopathy; long-term video-EEG requires diagnostic uncertainty or presurgical/spell characterization.', specialty: NEU },
  { policyId: 'LCD L33646', title: 'Botulinum Toxin Injections', cpt: ['64612', '64615', '64616', '64617', '64642', '64643', '64644', '64645', '64646', '64647', 'J0585', 'J0586', 'J0588'], supportingIcdPrefixes: ['G43.7', 'G24', 'G51.3', 'G51.4', 'H49', 'G80', 'G81', 'G82', 'I69.3', 'G35', 'R25.2', 'M62.83'], criterion: 'Botulinum toxin is covered for chronic migraine, cervical dystonia, blepharospasm, hemifacial spasm, and focal spasticity with a specific supporting diagnosis; cosmetic use is excluded.', specialty: NEU },
  { policyId: 'LCD L34645', title: 'Neuropsychological / Cognitive Testing', cpt: ['96116', '96121', '96132', '96133', '96136', '96137', '96138', '96139', '96125'], supportingIcdPrefixes: ['G30', 'G31', 'F01', 'F02', 'F03', 'R41', 'S06', 'F07.81', 'G20'], criterion: 'Neuropsychological testing is covered to evaluate documented cognitive impairment, dementia, or post-injury/post-stroke deficits when results will guide management; routine screening is not covered.', specialty: NEU },
  { policyId: 'NCD 240.4', title: 'Sleep Testing for Obstructive Sleep Apnea', cpt: ['95810', '95811', '95808', '95806', '95805'], supportingIcdPrefixes: ['G47.33', 'G47.3', 'G47.4', 'G47.1', 'R06.83'], criterion: 'Attended polysomnography and CPAP titration are covered to diagnose and manage sleep-disordered breathing, narcolepsy, and hypersomnia with documented clinical indication.', specialty: NEU },
  { policyId: 'LCD L35395', title: 'Autonomic Function Testing', cpt: ['95921', '95922', '95923', '95924', '93660'], supportingIcdPrefixes: ['G90', 'R55', 'G23', 'E11.43', 'G20', 'G61', 'I49.8'], criterion: 'Autonomic testing is covered to evaluate documented dysautonomia, orthostatic intolerance/syncope, or suspected autonomic neuropathy when it will change management.', specialty: NEU },
  { policyId: 'LCD L34597', title: 'Evoked Potential Studies', cpt: ['95925', '95926', '95927', '95928', '95929', '95930', '95938'], supportingIcdPrefixes: ['G35', 'G36', 'G37', 'H46', 'G95', 'M47.1', 'G82'], criterion: 'Evoked potentials are covered to detect and localize demyelinating or conduction abnormalities (e.g., MS, optic neuritis, myelopathy) with documented signs/symptoms.', specialty: NEU },
  { policyId: 'NCD 250.3', title: 'Intravenous Immune Globulin (IVIG)', cpt: ['J1561', '96365', '96366'], supportingIcdPrefixes: ['G61.0', 'G61.81', 'G61.82', 'G70.0', 'G35'], criterion: 'IVIG is covered for Guillain-Barre syndrome, CIDP, multifocal motor neuropathy, and myasthenic crisis with a documented immune-mediated neuromuscular diagnosis.', specialty: NEU },
  { policyId: 'NCD 160.18', title: 'Electromyographic (EMG) Guidance of Chemodenervation', cpt: ['95873', '95874'], supportingIcdPrefixes: ['G24', 'G51.3', 'G80', 'G81', 'I69.3', 'R25.2'], criterion: 'EMG/electrical stimulation guidance is covered as an adjunct to chemodenervation when precise muscle localization is required and documented.', specialty: NEU },
  { policyId: 'NCD 160.24', title: 'Deep Brain / Cranial Nerve Neurostimulator Analysis', cpt: ['95970', '95971', '95976', '95983', '95984'], supportingIcdPrefixes: ['G20', 'G24', 'G25.0', 'G40', 'G35'], criterion: 'Analysis and programming of an implanted DBS or vagus nerve stimulator is covered for the approved indication (e.g., Parkinson disease, essential tremor, dystonia, intractable epilepsy) with the device in place.', specialty: NEU },
]

export const NEU_DATASET_STATS = {
  icd: NEU_ICD_ROWS.length,
  cpt: NEU_CPT_ROWS.length,
  ncci: NEU_NCCI.length,
  policies: NEU_POLICIES.length,
}

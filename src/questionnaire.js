const QUESTION_DEFINITIONS = [
  { key: 'clientName', question: 'Client Name' },
  { key: 'currentAddress', question: 'Current Address' },
  { key: 'contactPhoneNumber', question: 'Contact Phone Number' },
  { key: 'emailAddress', question: 'Email Address' },
  { key: 'propertyAddress', question: 'Property Address (where the inspection will be performed)' },
  {
    key: 'activeWaterPenetration',
    question: 'Are you aware of any active water penetration/intrusion in the building? (Yes/No)',
  },
  {
    key: 'activeWaterPenetrationDetails',
    question: 'If yes, please explain active water penetration/intrusion details',
  },
  {
    key: 'priorMoistureWaterProblems',
    question: 'Have there ever been any prior experiences with moisture or water problems in the building? (Yes/No)',
  },
  {
    key: 'priorMoistureWaterProblemsDetails',
    question: 'If yes, please explain prior moisture or water problems details',
  },
  { key: 'activePlumbingLeaks', question: 'Are there any active plumbing leaks? (Yes/No)' },
  { key: 'activePlumbingLeaksLocation', question: 'If yes, please specify location of active plumbing leaks' },
  {
    key: 'repairedPlumbingLeaks',
    question: 'Have there been any plumbing leaks that have been repaired? (Yes/No)',
  },
  { key: 'repairedPlumbingLeaksDetails', question: 'If yes, please specify when and where repaired plumbing leaks occurred' },
  { key: 'mustyOdorAreas', question: 'Are there any areas of the building that have a musty odor? (Yes/No)' },
  { key: 'mustyOdorAreasWhere', question: 'If yes, please specify where there are musty odor areas' },
  {
    key: 'apparentMoldGrowth',
    question: 'Are you aware of any apparent mold growth (or mold) in the building? (Yes/No)',
  },
  { key: 'apparentMoldGrowthDescription', question: 'If yes, please describe apparent mold growth' },
  {
    key: 'previouslyInspectedOrTested',
    question: 'Has the property ever been inspected or tested for mold growth (or mold)? (Yes/No)',
  },
  {
    key: 'previouslyInspectedOrTestedDetails',
    question: 'If yes, please provide details or a copy of the report',
  },
  {
    key: 'occupantHealthAffected',
    question:
      'Are any occupants experiencing or have ever experienced health effects from asthma, allergies, breathing problems, or mold exposure? (Yes/No)',
  },
  {
    key: 'occupantsUnderPhysicianCare',
    question: 'Are any occupants under a physician’s care for significant health effects attributed to mold exposure? (Yes/No)',
  },
  {
    key: 'moldLitigation',
    question: 'Is there any litigation in progress or being considered in relation to mold in the building? (Yes/No)',
  },
]

const normalizeAnswer = (value) => {
  if (value === undefined || value === null) return ''
  return String(value)
}

const readAnswer = (questionnaire, definition) => {
  if (!questionnaire || typeof questionnaire !== 'object') return ''
  if (Object.hasOwn(questionnaire, definition.key)) return normalizeAnswer(questionnaire[definition.key])
  if (Object.hasOwn(questionnaire, definition.question)) return normalizeAnswer(questionnaire[definition.question])
  return ''
}

const normalizeQuestionnaire = (questionnaire = {}) =>
  QUESTION_DEFINITIONS.reduce((accumulator, definition) => {
    accumulator[definition.question] = readAnswer(questionnaire, definition)
    return accumulator
  }, {})

const questionnaireToEntries = (questionnaire = {}) =>
  QUESTION_DEFINITIONS.map((definition) => ({
    key: definition.key,
    question: definition.question,
    answer: readAnswer(questionnaire, definition),
  }))

module.exports = {
  QUESTION_DEFINITIONS,
  normalizeQuestionnaire,
  questionnaireToEntries,
}

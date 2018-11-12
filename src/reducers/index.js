import { combineReducers } from 'redux'
import { routerReducer as routing } from 'react-router-redux'

import settings from './settings'
import preview from './preview'
import modals from './modals'
import projects from './projects'
import alerts from './alerts'
import notifs from './notifs'
import error from './error'
import selectedProjects from './selectedProjects'
import externalFileOverlay from './externalFileOverlay'
import search from './search'
import snippets from './snippets'
import l10n from './l10n'

const rootReducer = combineReducers({
  routing,
  settings,
  preview,
  modals,
  alerts,
  notifs,
  projects,
  error,
  selectedProjects,
  externalFileOverlay,
  search,
  snippets,
  l10n,
})

export default rootReducer

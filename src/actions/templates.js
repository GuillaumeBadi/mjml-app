import { createAction } from 'redux-actions'
import path from 'path'
import { push } from 'react-router-redux'
import shortid from 'shortid'
import { Map } from 'immutable'
import { remote } from 'electron'
import beautify from 'js-beautify'

import { error, notify } from 'helpers/notification'
import { emitAlert } from 'actions/alerts'

const dialog = remote.require('dialog')

import {
  readTemplates as fsReadTemplates,
  save,
  readFile,
  writeFile,
  deleteTemplate as fsDeleteTemplate,
} from 'helpers/file-system'

import {
  updateConfig,
} from 'actions/index'

import defaultContent from 'assets/defaultContent'

/**
 * Triggers RECEIVE_TEMPLATES and set the templates in the store
 *
 * @param {Array} templates
 */
const receiveTemplates = createAction('RECEIVE_TEMPLATES', templates => templates)

/**
 * Read all the local templates and add them to the state
 *
 * @param {Function} dispatch store.dispatch function
 * @returns {Promise}
 */
export const readTemplates = () => dispatch => {
  return fsReadTemplates()
    .then(templates => dispatch(receiveTemplates(templates)))
}

/**
 * Set the current template
 *
 * @param {Object} template the current template
 */
export const setTemplate = createAction('SET_TEMPLATE', template => template)

/**
 * Set the current template and redirect the app to the editor
 *
 * @param {Object} template the new current template
 */
export const loadTemplate = template => dispatch => {
  dispatch(setTemplate(template))
  dispatch(push('editor'))
}

/**
 * Template update utilities
 */
export const doUpdateTemplate = createAction('UPDATE_TEMPLATE')
const doUpdateCurrentTemplate = createAction('UPDATE_CURRENT_TEMPLATE', updater => updater)

/**
 * Update the current template
 *
 * @param {Function} updater the update function that updates the template
 * @param {Function} dispatch store.dispatch function
 * @param {Function} getState returns the current state
 */
export const updateCurrentTemplate = updater => (dispatch, getState) => {

  // create empty promise, as we don't know if we have to generate
  // html or not, #opti
  let promise = Promise.resolve()

  // get current template
  const templates = getState().templates
  const currentId = templates.get('current')
  const template = templates.get('list').find(template => template.get('id') === currentId)

  // update the template with updater
  let newTemplate = updater(template)

  // re-calculate mjml only if mjml has changed
  if (newTemplate.get('mjml') !== template.get('mjml')) {

    // get service method
    const { mjml2html } = remote.require('./services')

    // chain promise ;-) yolo
    promise = promise.then(() => new Promise((resolve, reject) => {

      // generate html
      mjml2html(newTemplate.get('mjml'), (err, html) => {
        if (err) {
          dispatch(emitAlert(err.toString(), 'error'))
          reject(err)
        } else {
          newTemplate = newTemplate.set('html', html)
        }
        resolve()
      })

    }))

  }

  return promise.then(() => {

    // update modification date
    newTemplate = newTemplate.set('modificationDate', new Date())

    // save template
    dispatch(doUpdateCurrentTemplate(() => newTemplate))

  })
}

/**
 * Finds and updates the template
 *
 * @param {String} id the wanted template's id
 */
export const saveTemplateWithId = id => (dispatch, getState) => {

  const state = getState()
  const { templates } = state

  const list = templates.get('list')
  const template = list.get(list.findIndex(
    template => template.get('id') === id
  ))

  const cleaned = template
    .delete('thumbnailLoading')

  save(cleaned)
}

/**
 * Saves the current template to the file system
 *
 * @param {Function} dispatch store.dispatch
 * @param {Function} getState returns the current state
 */
export const saveTemplate = () => (dispatch, getState) => {

  const state = getState()
  const { templates } = state

  return dispatch(saveTemplateWithId(templates.get('current')))
}

const templateCreated = createAction('TEMPLATE_CREATED')

/**
 * Creates a new template
 *
 * @param {String} mjml mjml content
 * @param {Function} dispatch store.dispatch function
 */
export const createNewTemplate = (mjml = defaultContent, opts = {}) => dispatch => {

  // get service method
  const { mjml2html } = remote.require('./services')

  mjml2html(mjml, (err, html) => {
    if (err) {
      dispatch(emitAlert('Bad input file.', 'error'))
      return
    }
    const now = new Date()
    const newTemplate = Map({
      id: shortid.generate(),
      name: opts.name || 'no name',
      mjml,
      html,
      creationDate: now,
      modificationDate: now,
    })

    dispatch(templateCreated(newTemplate))
    dispatch(saveTemplateWithId(newTemplate.get('id')))
    dispatch(makeSnapshot(newTemplate))

    if (!opts.noRedirect) {
      dispatch(setTemplate(newTemplate))
      dispatch(push('editor'))
    }

  })
}

const templateDeleted = createAction('TEMPLATE_DELETED')

/**
 * Deletes a template
 *
 * @param {Object} template the template to be deleted
 */
export const deleteTemplate = template => dispatch => {
  const id = template.get('id')
  dispatch(templateDeleted(id))
  fsDeleteTemplate(id)
    .then(() => notify('Deleted!'))
    .catch(() => error('Not Deleted!'))
}

/**
 * Show the open dialog and load an MJML template
 *
 * @param {Function} dispatch store.dispatch function
 * @returns {undefined}
 */
export const open = () => dispatch => {
  dialog.showOpenDialog({
    filters: [{ name: 'MJML Files', extensions: ['mjml'] }],
  }, (filenames) => {
    if (!filenames) { return }
    const filename = filenames[0]
    if (filename.split('.').pop() !== 'mjml') { return }

    const isWin = (/^win/.test(process.platform))
    const directorySplit = isWin ? '\\' : '/'
    const templateName = filename.split(directorySplit).pop()
        .split('.').shift()

    readFile(filename)
      .then(content => dispatch(createNewTemplate(content, { name: templateName })))
  })
}

/**
 * Show the save dialog to export the current template as MJML or HTML
 *
 * @param {Object} template the template to be saved
 * @param {enum('mjml', 'html')} type the file type
 */
export const exportTemplate = ({ template, type }) => (dispatch, getState) => {

  const fileName = `${template.get('name')}.${type}`

  // get last used folder in config
  const lastFolder = getState().config.get('lastFolder', null)

  dialog.showSaveDialog({
    defaultPath: lastFolder ? path.join(lastFolder, fileName) : fileName,
  }, (filePath) => {
    if (!filePath) { return }

    const ext = filePath.split('.').pop()
    const name = ext !== type ? `${filePath}.${type}` : filePath
    const content = template.get(type)
    const output = (type === 'html') ? beautify.html(content) : content
    writeFile(name, output)
      .then(() => notify('Saved!'))
      .catch(() => error('Not Saved!'))

    // store folder name
    // see http://stackoverflow.com/questions/818576
    const folder = filePath.match(/(.*)[/\\]/)[1] || ''
    if (folder) {
      const action = updateConfig(config => config.set('lastFolder', folder))
      dispatch(action)
    }
  })
}

/**
 * Create a snapshot of the template
 *
 * @param {Object} template
 * @param {Function} dispatch store.dispatch function
 */
export const makeSnapshot = template => dispatch => {

  const id = template.get('id')
  const html = template.get('html')
  const { takeSnapshot } = remote.require('./services')

  const setLoading = template => template.set('thumbnailLoading', true)
  const stopLoading = template => template.set('thumbnailLoading', false)

  dispatch(doUpdateTemplate({ id, updater: setLoading }))

  takeSnapshot(id, html, () => {
    dispatch(doUpdateTemplate({ id, updater: stopLoading }))
  })

}

/**
 * Load a preset by creating a template with the same content as the preset.
 *
 * @param {Object} preset preset definition
 */
export const usePreset = preset => dispatch => {
  dispatch(createNewTemplate(preset.get('mjml')))
}

/**
 * Duplicate a template
 *
 * @param {Object} template template definition
 */
export const duplicateTemplate = template => dispatch => {

  dispatch(createNewTemplate(template.get('mjml'), {
    name: `${template.get('name')}_copy`,
    noRedirect: true,
  }))

}

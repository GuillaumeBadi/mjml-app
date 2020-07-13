import React, { Component } from 'react'
import { connect } from 'react-redux'
import debounce from 'lodash/debounce'
import yaml from 'js-yaml'

import CodeMirror from 'codemirror/lib/codemirror'
import 'codemirror/mode/yaml/yaml'

import Modal from 'components/Modal'

import { updateSettings } from 'actions/settings'
import { addAlert } from 'reducers/alerts'

export default connect(
  state => ({
    engine: state.settings.getIn(['previewContent', 'engine'], 'html'),
    variables: state.settings.getIn(['previewContent', 'variables'], ''),
    lightTheme: state.settings.getIn(['editor', 'lightTheme'], false),
  }),
  {
    addAlert,
    updateSettings,
  },
)(
  class PreviewSettings extends Component {
    state = {
      variables: {},
      valid: true,
    }

    componentDidUpdate(prevProps) {
      if (!prevProps.isOpened && this.props.isOpened) {
        this.initEditor()
      }
    }

    handleChangeEngine = event => {
      this.props.updateSettings(settings => {
        return settings.setIn(['previewContent', 'engine'], event.target.value)
      })
    }

    handleChangeVars = debounce(() => {
      const raw = this._codeMirror.getValue()

      try {
        this.setState({ variables: yaml.safeLoad(raw) || {}, valid: true })
      } catch (err) {
        this.setState({ valid: false })
      }
    }, 200)

    applyVars = () => {
      this.props.updateSettings(settings => {
        return settings.setIn(['previewContent', 'variables'], this.state.variables)
      })
    }

    initEditor() {
      if (!this._textarea) return

      const { lightTheme, variables } = this.props

      if (this._codeMirror) {
        this._codeMirror.toTextArea()
        this._codeMirror = null
      }

      let content = ''

      try {
        content = Object.keys(variables).length > 0 ? yaml.safeDump(variables) : ''
        this.setState({ variables, valid: true })
      } catch (err) {
        this.props.addAlert('Initial variables cannot be serialized to YAML', 'error')
      }

      this._codeMirror = CodeMirror.fromTextArea(this._textarea, {
        tabSize: 2,
        dragDrop: false,
        mode: 'yaml',
        lineNumbers: false,
        theme: lightTheme ? 'neo' : 'one-dark',
      })

      this._codeMirror.setValue(content)

      this._codeMirror.on('change', this.handleChangeVars)
      this._codeMirror.on('blur', this.applyVars)
    }

    render() {
      const { engine, isOpened, onClose } = this.props
      const { valid } = this.state

      return (
        <Modal
          isOpened={isOpened}
          onClose={onClose}
          className="FilePreview--settings-modal p-10 d-f fd-c"
        >
          <div className="Modal--label">{'Preview settings'}</div>

          <div className="">
            {'Treat MJML output as '}

            <select value={engine} className="bordered" onChange={this.handleChangeEngine}>
              <option value="html">HTML</option>
              <option value="erb">ERB template</option>
            </select>
          </div>

          <div className="mt-10 d-f jc-sb">
            <div>{'Template variables (YAML):'}</div>
            <div className="yaml-invalid">{!valid && '× Invalid YAML'}</div>
          </div>
          <div className="bordered mt-5">
            <textarea ref={r => (this._textarea = r)} />
          </div>
        </Modal>
      )
    }
  },
)

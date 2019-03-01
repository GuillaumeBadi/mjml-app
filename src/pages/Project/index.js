import React, { Component } from 'react'
import pathModule from 'path'
import trash from 'trash'
import { connect } from 'react-redux'
import FaCog from 'react-icons/fa/cog'
import FaFolderOpen from 'react-icons/fa/arrow-up'
import IconCopy from 'react-icons/md/content-copy'
import IconCode from 'react-icons/md/code'
import IconCamera from 'react-icons/md/camera-alt'
import IconEmail from 'react-icons/md/email'
import IconAdd from 'react-icons/md/note-add'
import IconBeautify from 'react-icons/md/autorenew'
import fs from 'fs'
import { shell, clipboard } from 'electron'
import beautifyJS from 'js-beautify'
import { keys } from 'lodash'

import defaultMJML from 'data/defaultMJML'

import { openModal } from 'reducers/modals'
import { addAlert } from 'reducers/alerts'
import { setPreview, getPreview } from 'actions/preview'
import { switchLocale } from 'reducers/l10n'

import { fileDialog, saveDialog, fsWriteFile, asyncForEach } from 'helpers/fs'

import Button from 'components/Button'
import ButtonDropdown from 'components/Button/ButtonDropdown'
import FilesList from 'components/FilesList'

import BackButton from './BackButton'
import SendModal from './SendModal'
import AddFileModal from './AddFileModal'
import RemoveFileModal from './RemoveFileModal'

import { takeScreenshot, cleanUp } from 'helpers/takeScreenshot'

@connect(
  state => ({
    preview: state.preview,
    previewSize: state.settings.get('previewSize'),
    beautifyOutput: state.settings.getIn(['mjml', 'beautify']),
    locales: keys(state.l10n.l10n),
    activeLocale: state.l10n.activeLocale
  }),
  {
    openModal,
    addAlert,
    getPreview,
    setPreview,
    switchLocale,
  }
)
class ProjectPage extends Component {
  state = {
    path: this.props.location.query.path,
    activeFile: null,
  }

  componentDidMount() {
    this._page.focus()
  }

  componentWillUnmount() {
    this.props.setPreview(null)
  }

  handleBeautify = () => this._editor.beautify()

  handlePathChange = path => this.setState({ path, activeFile: null })

  handleClickImport = () => {
    const p = fileDialog({
      defaultPath: this.props.location.query.path,
      properties: ['openFile'],
      filters: [{ name: 'All Files', extensions: ['mjml'] }],
    })

    if (!p) {
      return
    }

    fs.readFile(p, { encoding: 'utf8' }, (err, res) => {
      if (err) {
        return
      }
      this._content = res
    })
  }

  handleAddFile = fileName => {
    fs.writeFile(fileName, defaultMJML, err => {
      if (err) {
        this.props.addAlert('Error creating file', 'error')
        throw new Error(err)
      }
      this._filelist.refresh()
    })
  }

  handleRemoveFile = async fileName => {
    try {
      if ((await trash(fileName)) === undefined) {
        throw new Error('No file was deleted')
      }
      this.props.addAlert('File successfully removed', 'success')
    } catch (e) {
      this.props.addAlert('Could not delete file', 'error')
      throw new Error(e)
    }

    this._filelist.refresh()
    this.setState({ activeFile: null })
  }

  handleOpenInBrowser = () => {
    if (process.platform === 'darwin') {
      shell.showItemInFolder(this.state.path)
    } else {
      shell.openItem(this.state.path)
    }
  }

  handleActiveFileChange = activeFile => this.setState({ activeFile })

  handleCopyHTML = () => {
    const htmlContent = this.getHTMLOutput()
    clipboard.writeText(htmlContent)
    this.props.addAlert('Copied!', 'success')
  }

  handleExportToHTML = async () => {
    const p = saveDialog({
      title: 'Export to HTML file',
      defaultPath: this.state.path,
      filters: [{ name: 'All Files', extensions: ['html'] }],
    })
    if (!p) {
      return
    }

    const { addAlert } = this.props

    const htmlContent = this.getHTMLOutput()

    await fsWriteFile(p, htmlContent)
    addAlert('Successfully exported HTML', 'success')
    this._filelist.refresh()
  }

  handleExportAllToHTML = async () => {
    const { addAlert, getPreview, locales } = this.props

    const p = saveDialog({
      title: 'Export to HTML file',
      defaultPath: pathModule.basename(this.state.activeFile.path, '.mjml'),
      filters: [{ name: 'All Files', extensions: ['html'] }],
    })
    if (!p) {
      return
    }

    const folder = pathModule.dirname(p)
    const fileName = pathModule.basename(p)

    await asyncForEach(locales, async locale => {
      const { preview } = await getPreview(this.state.activeFile.path, '', locale, true)
      await fsWriteFile(pathModule.join(folder, `${locale}_${fileName}`), preview)
      addAlert(`Successfully exported HTML for ${locale} locale`, 'success')
    })

    this._filelist.refresh()
  }

  handleScreenshot = async () => {
    const { preview, previewSize, addAlert, location } = this.props

    const filename = pathModule.basename(this.state.activeFile.name, '.mjml')

    const [mobileWidth, desktopWidth] = [previewSize.get('mobile'), previewSize.get('desktop')]

    const [mobileScreenshot, desktopScreenshot] = await Promise.all([
      takeScreenshot(preview.content, mobileWidth, this.state.path),
      takeScreenshot(preview.content, desktopWidth, this.state.path),
    ])

    await cleanUp(this.state.path)

    await Promise.all([
      fsWriteFile(pathModule.join(location.query.path, `${filename}-mobile.png`), mobileScreenshot),
      fsWriteFile(
        pathModule.join(location.query.path, `${filename}-desktop.png`),
        desktopScreenshot,
      ),
    ])

    addAlert('Successfully saved mobile and desktop screenshots', 'success')
    this._filelist.refresh()
  }

  handleSwitchLocale = (locale) => this.props.switchLocale(locale)

  openSettingsModal = () => this.props.openModal('settings')
  openSendModal = () => this.props.openModal('send')
  openAddFileModal = () => this.props.openModal('addFile')

  getHTMLOutput() {
    const { preview, beautifyOutput } = this.props
    return beautifyOutput ? beautifyJS.html(preview.content) : preview.content
  }

  render() {
    const { preview, locales, activeLocale } = this.props
    const { path, activeFile } = this.state

    const rootPath = this.props.location.query.path
    const projectName = pathModule.basename(rootPath)
    const isMJMLFile = activeFile && activeFile.name.endsWith('.mjml')
    const isJSONFile = activeFile && activeFile.name.endsWith('.json')

    return (
      <div className="fg-1 d-f fd-c o-n" tabIndex={0} ref={n => (this._page = n)}>
        <div className="d-f p-10 r" style={{ zIndex: 2 }}>
          <div className="fg-1 flow-h-10">
            <BackButton projectName={projectName} />
            <Button ghost onClick={this.openAddFileModal}>
              <IconAdd className="mr-5" />
              {'New file'}
            </Button>
          </div>
          <div className="d-f flow-h-10">
            {isMJMLFile || isJSONFile && [
              locales && <ButtonDropdown
                key={'locales'}
                dropdownWidth={100}
                actions={locales.map(locale => {
                  return {
                    label: locale,
                    onClick: () => this.handleSwitchLocale(locale),
                    choice: locale === activeLocale
                  }
                })}
              />
            ]}
            {isMJMLFile && (
              <Button key="beautify" transparent onClick={this.handleBeautify}>
                <IconBeautify style={{ marginRight: 5 }} />
                {'Beautify'}
              </Button>
            )}
            <Button transparent onClick={this.handleOpenInBrowser}>
              <FaFolderOpen style={{ marginRight: 5 }} />
              {'Open'}
            </Button>
            {preview &&
              preview.type === 'html' && [
                <Button key={'send'} transparent onClick={this.openSendModal}>
                  <IconEmail style={{ marginRight: 5 }} />
                  {'Send'}
                </Button>,
                <ButtonDropdown
                  ghost
                  key={'export'}
                  dropdownWidth={300}
                  actions={[
                    {
                      icon: <IconCopy />,
                      label: 'Copy HTML',
                      desc: 'Copy the result HTML to clipboard',
                      onClick: this.handleCopyHTML,
                    },
                    {
                      icon: <IconCode />,
                      label: 'Export to HTML file',
                      desc: 'Save the result HTML file to disk',
                      onClick: this.handleExportToHTML,
                    },
                    {
                      icon: <IconCode />,
                      label: 'Export all locales to HTML file',
                      desc: 'Save all locales result HTML files to disk',
                      onClick: this.handleExportAllToHTML,
                    },
                    {
                      icon: <IconCamera />,
                      label: 'Screenshot',
                      desc: 'Save a screenshot of mobile & desktop result',
                      onClick: this.handleScreenshot,
                    },
                  ]}
                />,
              ]}
          </div>
          <Button
            className="ml-10"
            ghost
            onClick={this.openSettingsModal}
            ref={n => (this._btnSettings = n)}
          >
            <FaCog />
          </Button>
        </div>

        <div className="fg-1 d-f fd-c r" style={{ zIndex: 1 }}>
          <FilesList
            onRef={n => (this._filelist = n)}
            onEditorRef={n => (this._editor = n)}
            withPreview
            withHome
            rootPath={rootPath}
            path={path}
            activeFile={activeFile}
            onActiveFileChange={this.handleActiveFileChange}
            onPathChange={this.handlePathChange}
            onAddClick={this.openAddModal}
            onAddFile={this.handleAddFile}
            onRemoveFile={this.handleRemoveFile}
            focusHome
          />
        </div>

        <SendModal />
        <AddFileModal rootPath={path} onAdd={this.handleAddFile} />
        <RemoveFileModal rootPath={path} onRemove={this.handleRemoveFile} />
      </div>
    )
  }
}

export default ProjectPage

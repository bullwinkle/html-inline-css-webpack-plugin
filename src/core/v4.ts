import * as HTMLWebpackPlugin from 'html-webpack-plugin'
import { Compiler } from 'webpack'

import { TAP_KEY_PREFIX } from '../types'
import { BasePlugin } from './base-plugin'

interface BeforeAssetTagGenerationData {
  outputName: string
  assets: {
    publicPath: string
    css: string[]
  }
  plugin: HTMLWebpackPlugin
}

interface BeforeEmitData {
  html: string
  outputName: string
  plugin: HTMLWebpackPlugin
}

type CSSStyle = string

export class PluginForHtmlWebpackPluginV4 extends BasePlugin {
  // Using object reference to distinguish styles for multiple files
  private cssStyleMap: Map<HTMLWebpackPlugin, CSSStyle[]> = new Map()

  private prepareCSSStyle (data: BeforeAssetTagGenerationData) {
    data.assets.css.forEach((cssLink, index) => {
      if (this.isCurrentFileNeedsToBeInlined(cssLink)) {
        const style = this.getCSSStyle({
          cssLink,
          publicPath: data.assets.publicPath,
        })

        if (style) {
          if (this.cssStyleMap.has(data.plugin)) {
            this.cssStyleMap.get(data.plugin)!.push(style)
          } else {
            this.cssStyleMap.set(data.plugin, [style])
          }

          // prevent generate <link /> tag
          data.assets.css.splice(index, 1)
        }
      }
    })
  }

  private process (data: BeforeEmitData) {
    // check if current html needs to be inlined
    if (this.isCurrentFileNeedsToBeInlined(data.outputName)) {
      const cssStyles = this.cssStyleMap.get(data.plugin) || []

      cssStyles.forEach((style) => {
        data.html = this.addStyle({
          style,
          html: data.html,
          htmlFileName: data.outputName,
        })
      })

      data.html = this.cleanUp(data.html)
    }
  }

  apply (compiler: Compiler) {
    compiler.hooks.compilation.tap(
      `${TAP_KEY_PREFIX}_compilation`,
      (compilation) => {
        const hooks: HTMLWebpackPlugin.Hooks = (HTMLWebpackPlugin as any).getHooks(
          compilation,
        )

        hooks.beforeAssetTagGeneration.tapAsync(
          `${TAP_KEY_PREFIX}_beforeAssetTagGeneration`,
          (data, callback) => {
            this.prepare(compilation)
            this.prepareCSSStyle(data)
            callback();
          },
        )

        hooks.afterTemplateExecution.tapAsync(`${TAP_KEY_PREFIX}_beforeEmit`, (data, callback) => {
          this.process(data)
          callback();
        })
      },
    )
  }
}

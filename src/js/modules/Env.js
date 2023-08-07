/** @module Env */

import Helper from './Helper.js';
import NamespaceFetcher from './NamespaceFetcher.js';
import QueryParser from './QueryParser.js';
import jsyaml from 'js-yaml';

/** Set and remember the environment. */

export default class Env {
  /**
   * Set helper variables.
   */
  constructor(env) {
    this.setToThis(env);
    this.configUrlTemplate =
      'https://raw.githubusercontent.com/{%github}/trovu-data-user/master/config.yml';
    this.logs = [];
  }

  setToThis(env) {
    if (!env) {
      return;
    }
    for (const key in env) {
      this[key] = env[key];
    }
  }

  /**
   * Get the params from env.
   *
   * @return {object} - The built params.
   */
  getParams() {
    const params = {};

    // Put environment into hash.
    if (this.github) {
      params['github'] = this.github;
    } else {
      params['language'] = this.language;
      params['country'] = this.country;
    }
    if (this.debug) {
      params['debug'] = 1;
    }
    // Don't add defaultKeyword into params
    // when Github user is set.
    if (this.defaultKeyword && !this.github) {
      params['defaultKeyword'] = this.defaultKeyword;
    }
    if (this.status) {
      params['status'] = this.status;
    }
    if (this.query) {
      params['query'] = this.query;
    }
    if (this.alternative) {
      params['alternative'] = this.alternative;
    }
    if (this.key) {
      params['key'] = this.key;
    }

    return params;
  }

  /**
   * Get the parameters as string.
   */
  getParamStr() {
    const params = this.getParams();
    const paramStr = Helper.getUrlParamStr(params);
    return paramStr;
  }

  /**
   * Set the initial class environment vars either from params or from GET hash string.
   *
   * @param {array} params - List of parameters to be used in environment.
   */
  async populate(params) {
    if (!params) {
      params = Helper.getUrlParams();
    }

    if (typeof params.github === 'string' && params.github !== '') {
      await this.setWithUserConfigFromGithub(params);
    }

    Object.assign(this, params);
    Object.assign(this, QueryParser.parse(this.query));
    await this.setDefaults();

    if (this.extraNamespaceName) {
      this.namespaces.push(this.extraNamespaceName);
    }

    this.namespaceInfos = await new NamespaceFetcher(this).getNamespaceInfos(
      this.namespaces,
    );
  }

  /**
   * Set the user configuration from their fork in their Github profile.
   *
   * @param {array} params - Here, 'github' and 'debug' will be used
   */
  async setWithUserConfigFromGithub(params) {
    const config = await this.getUserConfigFromGithub(params);
    if (config) {
      Object.assign(this, config);
    }
  }

  /**
   * Get the user configuration from their fork in their Github profile.
   *
   * @param {array} params - Here, 'github' and 'debug' will be used
   *
   * @return {(object|boolean)} config - The user's config object, or false if fetch failed.
   */
  async getUserConfigFromGithub(params) {
    const configUrl = this.configUrlTemplate.replace(
      '{%github}',
      params.github,
    );
    const configYml = await Helper.fetchAsync(configUrl, this);
    if (configYml) {
      try {
        const config = jsyaml.load(configYml);
        return config;
      } catch (error) {
        this.error(`Error parsing ${configUrl}: ${error.message}`);
      }
    } else {
      this.error(`Error reading Github config from ${configUrl}`);
    }
  }

  // Param getters ====================================================

  /**
   * Get the default language and country from browser.
   *
   * @return {object} [language, country] - The default language and country.
   */
  async getDefaultLanguageAndCountry() {
    let { language, country } = this.getLanguageAndCountryFromBrowser();

    if (!country) {
      try {
        country = await this.getCountryFromIp();
      } catch (error) {
        // TODO: Log about error, but don't stop.
      }
    }

    // Set defaults.
    language = language || 'en';
    country = country || 'us';

    // Ensure lowercase.
    language = language.toLowerCase();
    country = country.toLowerCase();

    return { language, country };
  }

  /**
   * Get the default language and country from browser.
   *
   * @return {object} [language, country] - The default language and country.
   */
  getLanguageAndCountryFromBrowser() {
    const languageStr = this.getNavigatorLanguage();
    let language, country;
    if (languageStr) {
      [language, country] = languageStr.split('-');
    }

    return { language, country };
  }

  /**
   * Wrapper for navigator language, capsuled to enable unit testing.
   *
   * @return {string} navigatorLanguage - The browser's value of navigator.language.
   */
  getNavigatorLanguage() {
    const languageStr = navigator.language;
    return languageStr;
  }

  /**
   * Get the country from the IP address.
   *
   * @return {string} country - The country as ISO 3166‑1 alpha-2 code
   */
  async getCountryFromIp() {
    const ipInfoText = await this.fetchDbIp();
    const ipInfo = JSON.parse(ipInfoText);
    const country = ipInfo.countryCode;
    return country;
  }

  async fetchDbIp() {
    const ipInfoUrl = 'https://api.db-ip.com/v2/free/self';
    const ipInfoText = await Helper.fetchAsync(ipInfoUrl, this);
    return ipInfoText;
  }

  /**
   * Set default environment variables if they are still empty.
   */
  async setDefaults() {
    let language, country;

    if (typeof this.language != 'string' || typeof this.country != 'string') {
      ({ language, country } = await this.getDefaultLanguageAndCountry());
    }

    // Default language.
    if (typeof this.language != 'string') {
      this.language = language;
    }
    // Default country.
    if (typeof this.country != 'string') {
      this.country = country;
    }
    // Default namespaces.
    if (typeof this.namespaces != 'object') {
      this.namespaces = ['o', this.language, '.' + this.country];
    }
    // Default debug.
    if (typeof this.debug != 'boolean') {
      this.debug = Boolean(this.debug);
    }
  }

  // Logging ==========================================================

  log(level, message) {
    this.logs.push({
      level: level,
      message: message,
    });
    if (this.debug) {
      Helper.log(message);
    }
  }
  info(message) {
    this.log('info', message);
  }
  warning(message) {
    this.log('warning', message);
  }
  success(message) {
    this.log('success', message);
  }
  error(message) {
    this.log('error', message);
    // Log all errors if debug is false,
    // because with debug, the errors were already logged.
    console.table(this.logs);
    if (!this.debug) {
      for (const log of this.logs) {
        Helper.log(log.message);
      }
    }
    // Stop execution.
    throw new Error(message);
  }
}

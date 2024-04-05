import DataManager from './DataManager';
import UrlProcessor from './UrlProcessor';
import fs from 'fs';
import jsyaml from 'js-yaml';

export default class Migrator {
  constructor() {}

  async migrateProtocol(options) {
    const dataPath = options.data;
    const shortcutsPath = options.shortcuts;
    const typesPath = options.types;
    const data = DataManager.load(options);
    for (const namespace in data.shortcuts) {
      for (const key in data.shortcuts[namespace]) {
        const [keyword, argCount] = key.split(' ');
        const args = [
          'arg1',
          'arg2',
          'arg3',
          'arg4',
          'arg5',
          'arg6',
          'arg7',
          'arg8',
          'arg9',
          'arg10',
        ];
        let shortcut = data.shortcuts[namespace][key];
        // If the URL starts with http, fetch its contents, migrate to https, fetch again, and compare results
        if (shortcut.url && shortcut.url.startsWith('http:')) {
          console.log(`Migrating ${namespace}.${key}`);
          const httpUrl = shortcut.url;
          const processedHttpUrl = UrlProcessor.replaceArguments(
            httpUrl,
            args,
            {
              language: 'en',
              country: 'us',
              data: { types: { city: {} } },
            },
          );
          // console.log(originalUrl);
          const processedHttpsUrl = processedHttpUrl.replace('http:', 'https:');

          try {
            const httpResponse = await fetch(processedHttpUrl);
            const httpText = await httpResponse.text();
            // console.log('originalText', originalText);
            const httpsResponse = await fetch(processedHttpsUrl);
            const httpsText = await httpsResponse.text();
            // console.log('httpsText', httpsText);

            if (httpsText === httpText) {
              console.log('==', key);
              shortcut.url = httpUrl.replace('http:', 'https:');
            } else {
              console.log('!=', key);
              // write both to files out.key.http and out.key.https
              const outPath = `out.${key}`;
              const outHttpPath = `${outPath}.http`;
              const outHttpsPath = `${outPath}.https`;
              // console.log('Writing', outHttpPath);
              // console.log('Writing', outHttpsPath);
              // fs.writeFileSync(outHttpPath, originalText, 'utf8');
              // fs.writeFileSync(outHttpsPath, httpsText, 'utf8');
            }
          } catch (error) {
            console.error(`Error migrating ${key}:`, error);
          }
        }
      }
      DataManager.write(data, dataPath, shortcutsPath, typesPath);
    }
  }

  migratePlaceholders(options) {
    const dataPath = options.data;
    const shortcutsPath = options.shortcuts;
    const typesPath = options.types;
    const filter = options.filter;
    const data = DataManager.load(dataPath, shortcutsPath, typesPath, filter);
    for (const namespace in data.shortcuts) {
      for (const key in data.shortcuts[namespace]) {
        let shortcut = data.shortcuts[namespace][key];
        // if shortcut typeoff string, convert to object
        if (typeof shortcut === 'string') {
          shortcut = this.replacePlaceholders(shortcut, namespace, key);
        }
        if (shortcut.url) {
          shortcut.url = this.replacePlaceholders(shortcut.url, namespace, key);
        }
        if (
          shortcut.deprecated &&
          shortcut.deprecated.alternative &&
          shortcut.deprecated.alternative.query
        ) {
          shortcut.deprecated.alternative.query =
            shortcut.deprecated.alternative.query.replace(/\{%(\d)\}/g, '<$1>');
        }
        if (shortcut.include && shortcut.include.key) {
          shortcut.include.key = this.replacePlaceholders(
            shortcut.include.key,
            namespace,
            key,
          );
        }
        data.shortcuts[namespace][key] = shortcut;
      }
      DataManager.write(data, dataPath, shortcutsPath, typesPath);
    }
  }

  replacePlaceholders(str, namespace, key) {
    for (const prefix of ['%', '\\$']) {
      const placeholders = UrlProcessor.getPlaceholdersFromStringLegacy(
        str,
        prefix,
      );
      for (const placeholderName in placeholders) {
        if (this.isOnlyNumber(placeholderName)) {
          console.log(
            `Warning: In shortcut ${namespace}.${key}, placeholder name ${placeholderName} is only a number.`,
          );
        }
        let newPlaceholder;
        const placeholder = placeholders[placeholderName];
        const match = Object.keys(placeholder)[0];
        const attributes = Object.values(placeholder)[0];
        if (Object.keys(attributes).length === 0) {
          newPlaceholder = placeholderName;
        } else {
          newPlaceholder = {};
          newPlaceholder[placeholderName] = attributes;
        }
        const newPlaceholderYaml = jsyaml
          .dump(newPlaceholder, {
            flowLevel: 1,
          })
          .trim();
        let newPlaceholderYamlBrackets = '<';
        switch (prefix) {
          case '%':
            break;
          case '\\$':
            newPlaceholderYamlBrackets += '$';
            break;
        }
        newPlaceholderYamlBrackets += `${newPlaceholderYaml}>`;
        while (str.includes(match)) {
          str = str.replace(match, newPlaceholderYamlBrackets);
        }
      }
    }
    return str;
  }

  isOnlyNumber(str) {
    return Number.isFinite(Number(str));
  }

  migrateExamples(options) {
    const data = DataManager.load(options);
    for (const namespace in data.shortcuts) {
      for (const key in data.shortcuts[namespace]) {
        let shortcut = data.shortcuts[namespace][key];
        // Normalize examples.
        if (shortcut.examples && !Array.isArray(shortcut.examples)) {
          const examples = [];
          for (const [argumentString, description] of Object.entries(
            shortcut.examples,
          )) {
            const example = {
              arguments: argumentString,
              description: description,
            };
            examples.push(example);
          }
          shortcut.examples = examples;
        }
        data.shortcuts[namespace][key] = shortcut;
      }
      DataManager.write(data, options);
    }
  }
}

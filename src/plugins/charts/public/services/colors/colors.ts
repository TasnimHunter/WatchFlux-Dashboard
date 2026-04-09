/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Any modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import _ from 'lodash';

import { CoreSetup } from 'opensearch-dashboards/public';

//import { euiPaletteColorBlind } from '@elastic/eui';
import { MappedColors } from './mapped_colors';

/**
 * Accepts an array of strings or numbers that are used to create a
 * a lookup table that associates the values (key) with a hex color (value).
 * Returns a function that accepts a value (i.e. a string or number)
 * and returns a hex color associated with that value.
 */
export class ColorsService {
  private _mappedColors?: MappedColors;

  public readonly seedColors = [
    '#00D4AA',  // 0 cyber teal
    '#4F8FFF',  // 1 electric blue
    '#FF4F4F',  // 2 alert red
    '#FFB547',  // 3 warning amber
    '#A78BFA',  // 4 violet
    '#38BDF8',  // 5 sky blue
    '#84CC16',  // 6 lime green
    '#FF4F9A',  // 7 hot pink
    '#FB923C',  // 8 soft orange
    '#94A3B8',  // 9 steel gray
  ];

  public get mappedColors() {
    if (!this._mappedColors) {
      throw new Error('ColorService not yet initialized');
    }

    return this._mappedColors;
  }

  init(uiSettings: CoreSetup['uiSettings']) {
    this._mappedColors = new MappedColors(uiSettings);
  }

  createColorLookupFunction(
    arrayOfStringsOrNumbers?: any,
    colorMapping: Partial<Record<string, string>> = {}
  ) {
    if (!Array.isArray(arrayOfStringsOrNumbers)) {
      throw new Error(
        `createColorLookupFunction expects an array but received: ${typeof arrayOfStringsOrNumbers}`
      );
    }

    arrayOfStringsOrNumbers.forEach(function (val) {
      if (!_.isString(val) && !_.isNumber(val) && !_.isUndefined(val)) {
        throw new TypeError(
          'createColorLookupFunction expects an array of strings, numbers, or undefined values'
        );
      }
    });

    this.mappedColors.mapKeys(arrayOfStringsOrNumbers);

    return (value: string) => {
      return colorMapping[value] || this.mappedColors.get(value);
    };
  }
}

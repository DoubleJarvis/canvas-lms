/*
 * Copyright (C) 2017 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import React from 'react'
import {mount} from 'enzyme'
import {Alert} from '@instructure/ui-alerts'
import {FormFieldGroup} from '@instructure/ui-form-field'
import LatePoliciesTabPanel from 'jsx/gradezilla/default_gradebook/components/LatePoliciesTabPanel'
import {Spinner} from '@instructure/ui-elements'

const latePolicyData = {
  missingSubmissionDeductionEnabled: true,
  missingSubmissionDeduction: 0,
  lateSubmissionDeductionEnabled: true,
  lateSubmissionDeduction: 0,
  lateSubmissionInterval: 'day',
  lateSubmissionMinimumPercentEnabled: false,
  lateSubmissionMinimumPercent: 0
}

function mountComponent(latePolicyProps = {}, otherProps = {}) {
  const defaults = {changeLatePolicy() {}, locale: 'en', showAlert: false}
  const props = {
    latePolicy: {changes: {}, validationErrors: {}, data: latePolicyData, ...latePolicyProps},
    ...defaults,
    ...otherProps
  }
  return mount(<LatePoliciesTabPanel {...props} />)
}

function latePenaltiesForm(wrapper) {
  return wrapper.find(FormFieldGroup).at(1)
}

function missingPenaltiesForm(wrapper) {
  return wrapper.find(FormFieldGroup).at(0)
}

function lateDeductionCheckbox(wrapper) {
  return wrapper.find('input[type="checkbox"]').at(1)
}

function lateDeductionInput(wrapper) {
  return latePenaltiesForm(wrapper)
    .find('input[type="text"]')
    .at(0)
}

function lateDeductionIntervalSelect(wrapper) {
  return latePenaltiesForm(wrapper)
    .find('CanvasSelect')
    .at(0)
}

function lateDeductionIntervalSelectInput(wrapper) {
  return latePenaltiesForm(wrapper)
    .find('input')
    .at(0)
}

function lateSubmissionMinimumPercentInput(wrapper) {
  return latePenaltiesForm(wrapper)
    .find('input[type="text"]')
    .at(2)
}

function missingDeductionCheckbox(wrapper) {
  return wrapper.find('input[type="checkbox"]').at(0)
}

function missingDeductionInput(wrapper) {
  return missingPenaltiesForm(wrapper)
    .find('input[type="text"]')
    .at(0)
}

function gradedSubmissionsAlert(wrapper) {
  return wrapper
    .find(Alert)
    .filterWhere(n =>
      n.text().includes('Changing the late policy will affect previously graded submissions')
    )
}

function spinner(wrapper) {
  return wrapper.find(Spinner)
}

function changeLateDeductionIntervalSelect(wrapper, value) {
  // enzyme's simulate didn't work for 'change' on CanvasSelect for some unknown reason
  return lateDeductionIntervalSelect(wrapper)
    .props()
    .onChange({target: {value}}, value)
}

QUnit.module('LatePoliciesTabPanel: Alert', hooks => {
  let wrapper

  hooks.afterEach(() => {
    wrapper.unmount()
  })

  test('initializes with an alert showing if passed showAlert: true', () => {
    wrapper = mountComponent({}, {showAlert: true})
    strictEqual(gradedSubmissionsAlert(wrapper).length, 1)
  })

  test('does not initialize with an alert showing if passed showAlert: false', () => {
    wrapper = mountComponent()
    strictEqual(gradedSubmissionsAlert(wrapper).length, 0)
  })

  test('focuses on the missing submission input when the alert closes', () => {
    wrapper = mountComponent({}, {showAlert: true})
    const instance = wrapper.instance()
    const input = instance.missingSubmissionDeductionInput
    sinon.stub(input, 'focus')
    instance.closeAlert()
    strictEqual(input.focus.callCount, 1)
    input.focus.restore()
  })

  test('does not focus on the missing submission checkbox when the alert closes', () => {
    wrapper = mountComponent({}, {showAlert: true})
    const instance = wrapper.instance()
    const checkbox = instance.missingSubmissionCheckbox
    sinon.stub(checkbox, 'focus')
    instance.closeAlert()
    strictEqual(checkbox.focus.callCount, 0)
    checkbox.focus.restore()
  })

  test(
    'focuses on the missing submission checkbox when the alert closes if the' +
      'missing submission input is disabled',
    () => {
      const data = {...latePolicyData, missingSubmissionDeductionEnabled: false}
      wrapper = mountComponent({data}, {showAlert: true})
      const instance = wrapper.instance()
      const checkbox = instance.missingSubmissionCheckbox
      sinon.stub(checkbox, 'focus')
      instance.closeAlert()
      strictEqual(checkbox.focus.callCount, 1)
      checkbox.focus.restore()
    }
  )

  test(
    'does not focus on the missing submission input when the alert closes if the' +
      'missing submission input is disabled',
    () => {
      const data = {...latePolicyData, missingSubmissionDeductionEnabled: false}
      wrapper = mountComponent({data}, {showAlert: true})
      const instance = wrapper.instance()
      const input = instance.missingSubmissionDeductionInput
      sinon.stub(input, 'focus')
      instance.closeAlert()
      strictEqual(input.focus.callCount, 0)
      input.focus.restore()
    }
  )
})

QUnit.module('LatePoliciesTabPanel: spinner', {
  teardown() {
    this.wrapper.unmount()
  }
})

test('shows a spinner if no data is present', function() {
  this.wrapper = mountComponent({data: undefined})
  strictEqual(spinner(this.wrapper).length, 1)
})

test('does not show a spinner if data is present', function() {
  this.wrapper = mountComponent()
  strictEqual(spinner(this.wrapper).length, 0)
})

QUnit.module('LatePoliciesTabPanel: validations', {
  teardown() {
    this.wrapper.unmount()
  }
})

test('shows a message if missing deduction validation errors are passed', function() {
  this.wrapper = mountComponent({validationErrors: {missingSubmissionDeduction: 'An Error'}})
  ok(this.wrapper.text().includes('An Error'))
})

test('shows a message if late deduction validation errors are passed', function() {
  this.wrapper = mountComponent({validationErrors: {lateSubmissionDeduction: 'An Error'}})
  ok(this.wrapper.text().includes('An Error'))
})

QUnit.module('LatePoliciesTabPanel: missing submission deduction checkbox', {
  teardown() {
    this.wrapper.unmount()
  }
})

test('calls the changeLatePolicy function when the missing submission deduction checkbox is changed', function() {
  const changeLatePolicy = sinon.stub()
  this.wrapper = mountComponent({}, {changeLatePolicy})
  missingDeductionCheckbox(this.wrapper).simulate('change', {target: {checked: false}})
  strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
  deepEqual(
    changeLatePolicy.getCall(0).args[0].changes,
    {missingSubmissionDeductionEnabled: false},
    'sends the changes'
  )
})

test(
  'does not send any changes to the changeLatePolicy function on the second action if ' +
    'the missing submission deduction checkbox is unchecked and then checked',
  function() {
    const changeLatePolicy = sinon.stub()
    this.wrapper = mountComponent({}, {changeLatePolicy})
    const checkbox = missingDeductionCheckbox(this.wrapper)
    checkbox.simulate('change', {target: {checked: false}})
    checkbox.simulate('change', {target: {checked: true}})
    strictEqual(changeLatePolicy.callCount, 2, 'calls changeLatePolicy')
    deepEqual(changeLatePolicy.getCall(1).args[0].changes, {}, 'does not send any changes')
  }
)

QUnit.module('LatePoliciesTabPanel: missing submission deduction input', {
  teardown() {
    this.wrapper.unmount()
  }
})

test('missing submission input has label describing it', function() {
  this.wrapper = mountComponent()
  const input = missingPenaltiesForm(this.wrapper)
    .find('#missing-submission-grade')
    .at(0)
  strictEqual(input.text(), 'Grade percentage for missing submissions')
})

test('enables the missing deduction input if the missing deduction checkbox is checked', function() {
  this.wrapper = mountComponent()
  notOk(missingDeductionInput(this.wrapper).prop('disabled'))
})

test('disables the missing deduction input if the missing deduction checkbox is unchecked', function() {
  const data = {...latePolicyData, missingSubmissionDeductionEnabled: false}
  this.wrapper = mountComponent({data})
  ok(missingDeductionInput(this.wrapper).prop('disabled'))
})

test(
  'calls the changeLatePolicy function with a new deduction when the missing submission ' +
    'deduction input is changed and is valid',
  function() {
    const changeLatePolicy = sinon.stub()
    this.wrapper = mountComponent({}, {changeLatePolicy})
    missingDeductionInput(this.wrapper).simulate('change', {target: {value: '22'}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].changes,
      {missingSubmissionDeduction: 78},
      'sends the changes'
    )
  }
)

test(
  'does not send any changes to the changeLatePolicy function when the missing submission ' +
    'deduction input is changed back to its initial value',
  function() {
    const changeLatePolicy = sinon.stub()
    this.wrapper = mountComponent({}, {changeLatePolicy})
    const input = missingDeductionInput(this.wrapper)
    input.simulate('change', {target: {value: '22'}})
    input.simulate('change', {target: {value: '100'}})
    strictEqual(changeLatePolicy.callCount, 2, 'calls changeLatePolicy')
    deepEqual(changeLatePolicy.getCall(1).args[0].changes, {}, 'does not send any changes')
  }
)

test(
  'calls the changeLatePolicy function with a validationError if the missing submission ' +
    'deduction input is changed and is not numeric',
  function() {
    const changeLatePolicy = sinon.stub()
    this.wrapper = mountComponent({}, {changeLatePolicy})
    missingDeductionInput(this.wrapper).simulate('change', {target: {value: 'abc'}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(changeLatePolicy.getCall(0).args[0].changes, {}, 'does not send changes')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].validationErrors,
      {missingSubmissionDeduction: 'Missing submission grade must be numeric'},
      'sends validation errors'
    )
  }
)

test('does not allow entering negative numbers for missing submission deduction', function() {
  const changeLatePolicy = sinon.stub()
  this.wrapper = mountComponent({}, {changeLatePolicy})
  const input = missingDeductionInput(this.wrapper)
  input.simulate('change', {target: {value: '-0.1'}})
  deepEqual(changeLatePolicy.getCall(0).args[0].changes, {})
  strictEqual(input.instance().value, '100')
})

test(
  'calls the changeLatePolicy function with a validationError if the missing submission ' +
    'deduction input is changed and is greater than 100',
  function() {
    const changeLatePolicy = sinon.stub()
    this.wrapper = mountComponent({}, {changeLatePolicy})
    missingDeductionInput(this.wrapper).simulate('change', {target: {value: '100.1'}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(changeLatePolicy.getCall(0).args[0].changes, {}, 'does not send changes')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].validationErrors,
      {missingSubmissionDeduction: 'Missing submission grade must be between 0 and 100'},
      'sends validation errors'
    )
  }
)

test(
  'calls the changeLatePolicy function without a validationError for missing submission ' +
    'deduction if a valid input is entered after an invalid input is entered',
  function() {
    const changeLatePolicy = sinon.stub()
    this.wrapper = mountComponent(
      {
        validationErrors: {
          missingSubmissionDeduction: 'Missing submission grade must be between 0 and 100'
        }
      },
      {changeLatePolicy}
    )
    missingDeductionInput(this.wrapper).simulate('change', {target: {value: '100'}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].validationErrors,
      {},
      'does not send validation errors for missingSubmissionDeduction'
    )
  }
)

QUnit.module('LatePoliciesTabPanel: late submission deduction checkbox', {
  teardown() {
    this.wrapper.unmount()
  }
})

test('calls the changeLatePolicy function when the late submission deduction checkbox is changed', function() {
  const changeLatePolicy = sinon.stub()
  const data = {...latePolicyData, lateSubmissionDeductionEnabled: false}
  this.wrapper = mountComponent({data}, {changeLatePolicy})
  lateDeductionCheckbox(this.wrapper).simulate('change', {target: {checked: true}})
  strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
  deepEqual(
    changeLatePolicy.getCall(0).args[0].changes,
    {lateSubmissionDeductionEnabled: true},
    'sends the changes'
  )
})

test(
  'does not send any changes to the changeLatePolicy function on the second action if ' +
    'the late submission deduction checkbox is unchecked and then checked',
  function() {
    const changeLatePolicy = sinon.stub()
    this.wrapper = mountComponent({}, {changeLatePolicy})
    const checkbox = lateDeductionCheckbox(this.wrapper)
    checkbox.simulate('change', {target: {checked: false}})
    checkbox.simulate('change', {target: {checked: true}})
    strictEqual(changeLatePolicy.callCount, 2, 'calls changeLatePolicy')
    deepEqual(changeLatePolicy.getCall(1).args[0].changes, {}, 'does not send any changes')
  }
)

test(
  'sets lateSubmissionMinimumPercentEnabled to true when the late submission deduction ' +
    'checkbox is checked and the late submission minimum percent is greater than zero',
  function() {
    const changeLatePolicy = sinon.stub()
    const data = {
      ...latePolicyData,
      lateSubmissionMinimumPercent: 1,
      lateSubmissionDeductionEnabled: false
    }
    this.wrapper = mountComponent({data}, {changeLatePolicy})
    lateDeductionCheckbox(this.wrapper).simulate('change', {target: {checked: true}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].changes,
      {lateSubmissionDeductionEnabled: true, lateSubmissionMinimumPercentEnabled: true},
      'sends the changes'
    )
  }
)

test(
  'does not set lateSubmissionMinimumPercentEnabled to true when the late submission deduction ' +
    'checkbox is checked and the late submission minimum percent is zero',
  function() {
    const changeLatePolicy = sinon.stub()
    const data = {...latePolicyData, lateSubmissionDeductionEnabled: false}
    this.wrapper = mountComponent({data}, {changeLatePolicy})
    lateDeductionCheckbox(this.wrapper).simulate('change', {target: {checked: true}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].changes,
      {lateSubmissionDeductionEnabled: true},
      'sends the changes'
    )
  }
)

QUnit.module('LatePoliciesTabPanel: late submission deduction input', {
  teardown() {
    this.wrapper.unmount()
  }
})

test('disables the late deduction input if the late deduction checkbox is unchecked', function() {
  const data = {...latePolicyData, lateSubmissionDeductionEnabled: false}
  this.wrapper = mountComponent({data})
  ok(lateDeductionInput(this.wrapper).prop('disabled'))
})

test('enables the late deduction input if the late deduction checkbox is checked', function() {
  this.wrapper = mountComponent()
  notOk(lateDeductionInput(this.wrapper).prop('disabled'))
})

test(
  'calls the changeLatePolicy function with a new deduction when the late submission ' +
    'deduction input is changed and is valid',
  function() {
    const changeLatePolicy = sinon.stub()
    this.wrapper = mountComponent({}, {changeLatePolicy})
    lateDeductionInput(this.wrapper).simulate('change', {target: {value: '22'}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].changes,
      {lateSubmissionDeduction: 22},
      'sends the changes'
    )
  }
)

test(
  'does not send any changes to the changeLatePolicy function when the late submission ' +
    'deduction input is changed back to its initial value',
  function() {
    const changeLatePolicy = sinon.stub()
    this.wrapper = mountComponent({}, {changeLatePolicy})
    const input = lateDeductionInput(this.wrapper)
    input.simulate('change', {target: {value: '22'}})
    input.simulate('change', {target: {value: '0'}})
    strictEqual(changeLatePolicy.callCount, 2, 'calls changeLatePolicy')
    deepEqual(changeLatePolicy.getCall(1).args[0].changes, {}, 'does not send any changes')
  }
)

test(
  'calls the changeLatePolicy function with a validationError if the late submission ' +
    'deduction input is changed and is not numeric',
  function() {
    const changeLatePolicy = sinon.stub()
    this.wrapper = mountComponent({}, {changeLatePolicy})
    lateDeductionInput(this.wrapper).simulate('change', {target: {value: 'abc'}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(changeLatePolicy.getCall(0).args[0].changes, {}, 'does not send changes')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].validationErrors,
      {lateSubmissionDeduction: 'Late submission deduction must be numeric'},
      'sends validation errors'
    )
  }
)

test('does not allow entering negative numbers for late submission deduction', function() {
  this.wrapper = mountComponent()
  const input = lateDeductionInput(this.wrapper)
  input.simulate('change', {target: {value: '-0.1'}})
  strictEqual(input.instance().value, '0')
})

test(
  'calls the changeLatePolicy function with a validationError if the late submission ' +
    'deduction input is changed and is greater than 100',
  function() {
    const changeLatePolicy = sinon.stub()
    this.wrapper = mountComponent({}, {changeLatePolicy})
    lateDeductionInput(this.wrapper).simulate('change', {target: {value: '100.1'}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(changeLatePolicy.getCall(0).args[0].changes, {}, 'does not send changes')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].validationErrors,
      {lateSubmissionDeduction: 'Late submission deduction must be between 0 and 100'},
      'sends validation errors'
    )
  }
)

test(
  'calls the changeLatePolicy function without a validationError for late submission ' +
    'deduction if a valid input is entered after an invalid input is entered',
  function() {
    const changeLatePolicy = sinon.stub()
    this.wrapper = mountComponent(
      {
        validationErrors: {
          lateSubmissionDeduction: 'Late submission deduction must be between 0 and 100'
        }
      },
      {changeLatePolicy}
    )
    lateDeductionInput(this.wrapper).simulate('change', {target: {value: '100'}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].validationErrors,
      {},
      'does not send validation errors for lateSubmissionDeduction'
    )
  }
)

QUnit.module('LatePoliciesTabPanel: late submission deduction interval select', hooks => {
  let wrapper

  hooks.afterEach(() => {
    wrapper.unmount()
  })

  test('disables the late deduction interval select if the late deduction checkbox is unchecked', () => {
    const data = {...latePolicyData, lateSubmissionDeductionEnabled: false}
    wrapper = mountComponent({data})
    ok(lateDeductionIntervalSelectInput(wrapper).prop('disabled'))
  })

  test('enables the late deduction interval select if the late deduction checkbox is checked', () => {
    wrapper = mountComponent()
    notOk(lateDeductionIntervalSelectInput(wrapper).prop('disabled'))
  })

  test('calls the changeLatePolicy function when the late sumbmission deduction interval select is changed', () => {
    const changeLatePolicy = sinon.stub()
    wrapper = mountComponent({}, {changeLatePolicy})
    changeLateDeductionIntervalSelect(wrapper, 'hour')
    strictEqual(changeLatePolicy.callCount, 1)
  })

  test('calls the changeLatePolicy function with a new deduction interval when the late sumbmission deduction interval select is changed', () => {
    const changeLatePolicy = sinon.stub()
    wrapper = mountComponent({}, {changeLatePolicy})
    changeLateDeductionIntervalSelect(wrapper, 'hour')
    const {
      firstCall: {
        args: [{changes}]
      }
    } = changeLatePolicy
    deepEqual(changes, {lateSubmissionInterval: 'hour'})
  })

  test('does not send any changes to the changeLatePolicy function when the late submission deduction interval is changed back to its initial value', () => {
    const changeLatePolicy = sinon.stub()
    wrapper = mountComponent({}, {changeLatePolicy})
    changeLateDeductionIntervalSelect(wrapper, 'hour')
    changeLateDeductionIntervalSelect(wrapper, 'day')
    const {
      secondCall: {
        args: [{changes}]
      }
    } = changeLatePolicy
    deepEqual(changes, {})
  })
})

QUnit.module('LatePoliciesTabPanel: late submission minimum percent input', hooks => {
  let wrapper

  hooks.afterEach(() => {
    wrapper.unmount()
  })

  test('calls the changeLatePolicy function with a new percent when the late submission minimum percent input is changed and is valid', () => {
    const changeLatePolicy = sinon.stub()
    const data = {
      ...latePolicyData,
      lateSubmissionMinimumPercent: 60,
      lateSubmissionMinimumPercentEnabled: true
    }
    wrapper = mountComponent({data}, {changeLatePolicy})
    lateSubmissionMinimumPercentInput(wrapper).simulate('change', {target: {value: '22'}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].changes,
      {lateSubmissionMinimumPercent: 22},
      'sends the changes'
    )
  })

  test('does not send any changes to the changeLatePolicy function when the late submission minimum percent input is changed back to its initial value', () => {
    const changeLatePolicy = sinon.stub()
    const data = {
      ...latePolicyData,
      lateSubmissionMinimumPercent: 60,
      lateSubmissionMinimumPercentEnabled: true
    }
    wrapper = mountComponent({data}, {changeLatePolicy})
    const input = lateSubmissionMinimumPercentInput(wrapper)
    input.simulate('change', {target: {value: '22'}})
    input.simulate('change', {target: {value: '60'}})
    strictEqual(changeLatePolicy.callCount, 2, 'calls changeLatePolicy')
    deepEqual(changeLatePolicy.getCall(1).args[0].changes, {}, 'does not send any changes')
  })

  test('sets lateSubmissionMinimumPercentEnabled to true if the minimum percent is changed from zero to non-zero', () => {
    const changeLatePolicy = sinon.stub()
    wrapper = mountComponent({}, {changeLatePolicy})
    const input = lateSubmissionMinimumPercentInput(wrapper)
    input.simulate('change', {target: {value: '22'}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].changes,
      {lateSubmissionMinimumPercent: 22, lateSubmissionMinimumPercentEnabled: true},
      'sends the changes'
    )
  })

  test('sets lateSubmissionMinimumPercentEnabled to false if the minimum percent is changed from non-zero to zero', () => {
    const changeLatePolicy = sinon.stub()
    const data = {
      ...latePolicyData,
      lateSubmissionMinimumPercent: 60,
      lateSubmissionMinimumPercentEnabled: true
    }
    wrapper = mountComponent({data}, {changeLatePolicy})
    const input = lateSubmissionMinimumPercentInput(wrapper)
    input.simulate('change', {target: {value: '0'}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].changes,
      {lateSubmissionMinimumPercent: 0, lateSubmissionMinimumPercentEnabled: false},
      'sends the changes'
    )
  })

  test('calls the changeLatePolicy function with a validationError if the late submission minimum percent input is changed and is not numeric', () => {
    const changeLatePolicy = sinon.stub()
    wrapper = mountComponent({}, {changeLatePolicy})
    lateSubmissionMinimumPercentInput(wrapper).simulate('change', {target: {value: 'abc'}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(changeLatePolicy.getCall(0).args[0].changes, {}, 'does not send changes')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].validationErrors,
      {lateSubmissionMinimumPercent: 'Lowest possible grade must be numeric'},
      'sends validation errors'
    )
  })

  test('does not allow entering negative numbers for late submission minimum percent', () => {
    wrapper = mountComponent()
    const input = lateSubmissionMinimumPercentInput(wrapper)
    input.simulate('change', {target: {value: '-0.1'}})
    strictEqual(input.instance().value, '0')
  })

  test('calls the changeLatePolicy function with a validationError if the late submission minimum percent input is changed and is greater than 100', () => {
    const changeLatePolicy = sinon.stub()
    wrapper = mountComponent({}, {changeLatePolicy})
    lateSubmissionMinimumPercentInput(wrapper).simulate('change', {target: {value: '100.1'}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(changeLatePolicy.getCall(0).args[0].changes, {}, 'does not send changes')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].validationErrors,
      {lateSubmissionMinimumPercent: 'Lowest possible grade must be between 0 and 100'},
      'sends validation errors'
    )
  })

  test('calls the changeLatePolicy function without a validationError for late submission minimum percent if a valid input is entered after an invalid input is entered', () => {
    const changeLatePolicy = sinon.stub()
    wrapper = mountComponent(
      {
        validationErrors: {
          lateSubmissionMinimumPercent: 'Lowest possible grade must be between 0 and 100'
        }
      },
      {changeLatePolicy}
    )
    lateSubmissionMinimumPercentInput(wrapper).simulate('change', {target: {value: '100'}})
    strictEqual(changeLatePolicy.callCount, 1, 'calls changeLatePolicy')
    deepEqual(
      changeLatePolicy.getCall(0).args[0].validationErrors,
      {},
      'does not send validation errors for lateSubmissionMinimumPercent'
    )
  })
})

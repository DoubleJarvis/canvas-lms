/*
 * Copyright (C) 2011 - present Instructure, Inc.
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

import _ from 'underscore'
import ModuleFile from 'compiled/models/ModuleFile'
import PublishCloud from 'jsx/shared/PublishCloud'
import ModuleDuplicationSpinner from 'jsx/modules/components/ModuleDuplicationSpinner'
import React from 'react'
import ReactDOM from 'react-dom'
import {reorderElements, renderTray} from 'jsx/move_item'
import PublishableModuleItem from 'compiled/models/PublishableModuleItem'
import PublishIconView from 'compiled/views/PublishIconView'
import LockIconView from 'compiled/views/LockIconView'
import MasterCourseModuleLock from 'jsx/blueprint_courses/apps/MasterCourseModuleLock'
import INST from './INST'
import I18n from 'i18n!context_modulespublic'
import $ from 'jquery'
import Helper from './context_modules_helper'
import CyoeHelper from 'jsx/shared/conditional_release/CyoeHelper'
import ContextModulesView from 'compiled/views/context_modules/context_modules' /* handles the publish/unpublish state */
import RelockModulesDialog from 'compiled/views/modules/RelockModulesDialog'
import vddTooltip from 'compiled/util/vddTooltip'
import vddTooltipView from 'jst/_vddTooltip'
import Publishable from 'compiled/models/Publishable'
import PublishButtonView from 'compiled/views/PublishButtonView'
import htmlEscape from './str/htmlEscape'
import setupContentIds from 'jsx/modules/utils/setupContentIds'
import get from 'lodash/get'
import axios from 'axios'
import { showFlashError } from 'jsx/shared/FlashAlert'
import './jquery.ajaxJSON'
import './jquery.instructure_date_and_time' /* dateString, datetimeString, time_field, datetime_field */
import './jquery.instructure_forms' /* formSubmit, fillFormData, formErrors, errorBox */
import 'jqueryui/dialog'
import 'compiled/jquery/fixDialogButtons'
import './jquery.instructure_misc_helpers' /* /\$\.underscore/ */
import './jquery.instructure_misc_plugins' /* .dim, confirmDelete, fragmentChange, showIf */
import './jquery.keycodes'
import './jquery.loadingImg'
import './jquery.templateData' /* fillTemplateData, getTemplateData */
import './vendor/date' /* Date.parse */
import 'jqueryui/sortable'
import 'compiled/jquery.rails_flash_notifications'

function scrollTo ($thing, time = 500) {
  if (!$thing || $thing.length === 0) return
  $('html, body').animate({
    scrollTop: $thing.offset().top,
  }, time)
}

  function refreshDuplicateLinkStatus($module) {
    if (ENV.DUPLICATE_ENABLED && !$module.find('.context_module_item.quiz').length && !$module.find('.cannot-duplicate').length) {
      $module.find('.duplicate_module_menu_item').removeAttr('hidden')
    } else {
      $module.find('.duplicate_module_menu_item').attr('hidden', true)
    }
  }

  // TODO: AMD don't export global, use as module
  /*global modules*/
  window.modules = (function() {
    return {
      updateTaggedItems: function() {
      },

      currentIndent: function($item) {
        var classes = $item.attr('class').split(/\s/);
        var indent = 0;
        for (var idx = 0; idx < classes.length; idx++) {
          if(classes[idx].match(/^indent_/)) {
            var new_indent = parseInt(classes[idx].substring(7), 10);
            if(!isNaN(new_indent)) {
              indent = new_indent;
            }
          }
        }
        return indent;
      },

      addModule: function() {
        var $module = $("#context_module_blank").clone(true).attr('id', 'context_module_new');
        $("#context_modules").append($module);
        var opts = modules.sortable_module_options;
        opts['update'] = modules.updateModuleItemPositions;
        $module.find(".context_module_items").sortable(opts);
        $("#context_modules.ui-sortable").sortable('refresh');
        $("#context_modules .context_module .context_module_items.ui-sortable").each(function() {
          $(this).sortable('refresh');
          $(this).sortable('option', 'connectWith', '.context_module_items');
        });
        modules.editModule($module);
      },

      updateModulePositions: function() {
        const ids = []
        $("#context_modules .context_module").each(function() {
          ids.push($(this).attr('id').substring('context_module_'.length));
        })
        const url = `${ENV.CONTEXT_URL_ROOT}/modules/reorder`
        $("#context_modules").loadingImage();
        $.ajaxJSON(url, 'POST', {order: ids.join(",")}, data => {
          $("#context_modules").loadingImage('remove');
          for(var idx in data) {
            var module = data[idx];
            $("#context_module_" + module.context_module.id).triggerHandler('update', module);
          }
        }, data => {
          $("#context_modules").loadingImage('remove');
        });
      },

      updateModuleItemPositions: function(event, ui) {
        const $module = ui.item.parents('.context_module')
        const moduleId = $module.attr('id').substring('context_module_'.length)
        const url = `${ENV.CONTEXT_URL_ROOT}/modules/${moduleId}/reorder`
        const items = []
        $module.find(".context_module_items .context_module_item").each(function() {
          items.push($(this).getTemplateData({textValues: ['id']}).id);
        });
        $module.find(".context_module_items.ui-sortable").sortable('disable');
        $module.disableWhileLoading(
          $.ajaxJSON(url, 'POST', {order: items.join(",")}, data => {
            if(data && data.context_module && data.context_module.content_tags) {
              for(var idx in data.context_module.content_tags) {
                var tag = data.context_module.content_tags[idx].content_tag;
                $module.find("#context_module_item_" + tag.id).fillTemplateData({
                  data: {position: tag.position}
                });
              }
            }
            $module.find(".context_module_items.ui-sortable").sortable('enable');
          }, data => {
            $module.find(".content").loadingImage('remove');
            $module.find(".content").errorBox(I18n.t('errors.reorder', 'Reorder failed, please try again.'));
          })
        );
        $('.context_module').each(function() {
          refreshDuplicateLinkStatus($(this));
        });
      },

      updateProgressions: function(callback) {
        if (!ENV.IS_STUDENT) {
          if (callback) {
            callback();
          }
          return;
        }
        var url = $(".progression_list_url").attr('href');
        if($(".context_module_item.progression_requirement:visible").length > 0) {
          $(".loading_module_progressions_link").show().attr('disabled', true);
        }
        $.ajaxJSON(url, 'GET', {}, function(data) {
          $(".loading_module_progressions_link").remove();
          var $user_progression_list = $("#current_user_progression_list");
          var progressions = [];
          for(var idx in data) {
            progressions.push(data[idx]);
          };
          var progressionsFinished = function() {
            if(!$("#context_modules").hasClass('editable')) {
              $("#context_modules .context_module").each(function() {
                modules.updateProgressionState($(this));
              });
            }
            if(callback) { callback(); }
          }
          var progressionCnt = 0;
          var nextProgression = function() {
            var data = progressions.shift();
            if(!data) {
              progressionsFinished();
              return;
            }
            var progression = data.context_module_progression;
            if (progression.user_id == window.ENV.current_user_id) {
              var $user_progression = $user_progression_list.find(".progression_" + progression.context_module_id)

              if ($user_progression.length === 0 && $user_progression_list.length > 0) {
                $user_progression = $user_progression_list.find(".progression_blank").clone(true);
                $user_progression.removeClass('progression_blank').addClass('progression_' + progression.context_module_id);
                $user_progression_list.append($user_progression);
              }
              if($user_progression.length > 0) {
                $user_progression.data('requirements_met', progression.requirements_met);
                $user_progression.data('incomplete_requirements', progression.incomplete_requirements);
                $user_progression.fillTemplateData({data: progression});
              }
            }
            progressionCnt++;
            if(progressionCnt >= 50) {
              progressionCnt = 0;
              setTimeout(nextProgression, 150);
            } else {
              nextProgression();
            }
          }
          nextProgression();
        }, () => {
          if(callback) { callback(); }
        });
      },

      updateAssignmentData: function(callback) {
        return $.ajaxJSON($(".assignment_info_url").attr('href'), 'GET', {}, data => {
          $.each(data, (id, info) => {
            var $context_module_item = $("#context_module_item_" + id);
            var data = {};
            if (info["points_possible"] != null) {
              data["points_possible_display"] = I18n.t('points_possible_short', '%{points} pts', {'points': I18n.n(info["points_possible"])});
            }
            if (info["todo_date"] != null) {
              data["due_date_display"] = $.dateString(info["todo_date"]);
            } else if (info["due_date"] != null) {
              if (info["past_due"] != null) {
                $context_module_item.data('past_due', true);
              }
              data["due_date_display"] = $.dateString(info["due_date"]);
            } else if (info['has_many_overrides'] != null) {
              data["due_date_display"] = I18n.t("Multiple Due Dates");
            } else if (info["vdd_tooltip"] != null) {
              info['vdd_tooltip']['link_href'] = $context_module_item.find('a.title').attr('href');
              $context_module_item.find('.due_date_display').html(vddTooltipView(info["vdd_tooltip"]));
            } else {
              $context_module_item.find('.due_date_display').remove();
            }
            $context_module_item.fillTemplateData({data: data, htmlValues: ['points_possible_display']});

            // clean up empty elements so they don't show borders in updated item group design
            if (info["points_possible"] === null) {
              $context_module_item.find('.points_possible_display').remove();
            }

          });
          vddTooltip();
          if (callback) { callback(); }
        }, () => {
          if (callback) { callback(); }
        });
      },

      loadMasterCourseData: function(tag_id) {
        if (ENV.MASTER_COURSE_SETTINGS) {
          // Grab the stuff for master courses if needed
          $.ajaxJSON(ENV.MASTER_COURSE_SETTINGS.MASTER_COURSE_DATA_URL, 'GET', {tag_id: tag_id}, data => {
            if (data.tag_restrictions) {
              $.each(data.tag_restrictions, (id, restriction) => {
                var $item = $('#context_module_item_' + id).not('.master_course_content');
                $item.addClass('master_course_content');
                if (Object.keys(restriction).some(r => restriction[r])) {
                  $item.attr('data-master_course_restrictions', JSON.stringify(restriction));  // need it if user selects Edit from cog menu
                }
                this.initMasterCourseLockButton($item, restriction);
              });
            }
          });
        }
      },

      itemClass: function(content_tag) {
        return (content_tag.content_type || "").replace(/^[A-Za-z]+::/, '') + "_" + content_tag.content_id;
      },

      updateAllItemInstances: function(content_tag) {
        $(".context_module_item."+modules.itemClass(content_tag)+" .title").each(function() {
          var $this = $(this);
          $this.text(content_tag.title);
          $this.attr('title', content_tag.title);
        });
      },
      editModule: function($module) {
        var $form = $("#add_context_module_form");
        $form.data('current_module', $module);
        var data = $module.getTemplateData({textValues: ['name', 'unlock_at', 'require_sequential_progress', 'publish_final_grade', 'requirement_count']});
        $form.fillFormData(data, {object_name: 'context_module'});
        var isNew = false;
        if($module.attr('id') == 'context_module_new') {
          isNew = true;
          $form.attr('action', $form.find(".add_context_module_url").attr('href'));
          $form.find(".completion_entry").hide();
          $form.attr('method', 'POST');
          $form.find(".submit_button").text(I18n.t('buttons.add', "Add Module"));
        } else {
          $form.attr('action', $module.find(".edit_module_link").attr('href'));
          $form.find(".completion_entry").show();
          $form.attr('method', 'PUT');
          $form.find(".submit_button").text(I18n.t('buttons.update', "Update Module"));
        }
        $form.find("#unlock_module_at").prop('checked', data.unlock_at).change()
        $form.find("#require_sequential_progress").attr('checked', data.require_sequential_progress == "true" || data.require_sequential_progress == "1");
        $form.find("#publish_final_grade").attr('checked', data.publish_final_grade == "true" || data.publish_final_grade == "1");

        var has_predecessors = $("#context_modules .context_module").length > 1 &&
                               $("#context_modules .context_module:first").attr("id") !== $module.attr("id")
        $form.find(".prerequisites_entry").showIf(has_predecessors);
        var prerequisites = [];
        $module.find(".prerequisites .prerequisite_criterion").each(function() {
          prerequisites.push($(this).getTemplateData({textValues: ['id', 'name', 'type']}));
        });

        $form.find(".prerequisites_list .criteria_list").empty();
        for(var idx in prerequisites) {
          var pre = prerequisites[idx];
          $form.find(".add_prerequisite_link:first").click();
          if(pre.type == 'context_module') {
            $form.find(".prerequisites_list .criteria_list .criterion:last select").val(pre.id).trigger('change');
          }
        }
        $form.find(".completion_entry .criteria_list").empty();
        $module.find(".content .context_module_item .criterion.defined").each(function() {
          var data = $(this).parents(".context_module_item").getTemplateData({textValues: ['id', 'criterion_type', 'min_score']});
          $form.find(".add_completion_criterion_link").click();
          $form.find(".criteria_list .criterion:last")
            .find(".id").val(data.id || "").change().end()
            .find(".type").val(data.criterion_type || "").change().end()
            .find(".min_score").val(data.min_score || "");
        });
        var no_items = $module.find(".content .context_module_item").length === 0;
        $form.find(".prerequisites_list .criteria_list").showIf(prerequisites.length != 0).end()
          .find(".add_prerequisite_link").showIf(has_predecessors).end()
          .find(".completion_entry .criteria_list").showIf(!no_items).end()

          .find(".completion_entry .no_items_message").hide().end()
          .find(".add_completion_criterion_link").showIf(!no_items);

        // Set no items or criteria message plus disable elements if there are no items or no requirements
        if (no_items) {
          $form.find(".completion_entry .no_items_message").show();
        }
        if ($module.find(".content .context_module_item .criterion.defined").length !== 0) {
          $(".requirement-count-radio").show();
        } else {
          $(".requirement-count-radio").hide();
        }

        var $requirementCount = $module.find('.pill li').data("requirement-count");
        if ($requirementCount == 1) {
          $('#context_module_requirement_count_1').prop('checked', true).change();
        } else {
          $('#context_module_requirement_count_').prop('checked', true).change();
        }


        $module.fadeIn('fast', () => {
        });
        $module.addClass('dont_remove');
        $form.find(".module_name").toggleClass('lonely_entry', isNew);
        var $toFocus = $('.ig-header-admin .al-trigger', $module);
        $form.dialog({
          autoOpen: false,
          modal: true,
          title: (isNew ? I18n.t('titles.add', "Add Module") : I18n.t('titles.edit', "Edit Module Settings")),
          width: 600,
          height: (isNew ? 400 : 600),
          close: function() {
            modules.hideEditModule(true);
            $toFocus.focus();
            var $contextModules = $("#context_modules .context_module");
            if ($contextModules.length) {
              $('#context_modules_sortable_container').removeClass('item-group-container--is-empty');
            }
          },
        }).dialog('open');
        $module.removeClass('dont_remove');
      },

      hideEditModule: function(remove) {
        var $module = $("#add_context_module_form").data('current_module'); //.parents(".context_module");
        if(remove && $module && $module.attr('id') == 'context_module_new' && !$module.hasClass('dont_remove')) {
          $module.remove();
        }
        $("#add_context_module_form:visible").dialog('close');
      },

      addItemToModule: function($module, data) {
        if (!data) { return $('<div/>'); }
        data.id = data.id || 'new'
        data.type = data.type || data['item[type]'] || $.underscore(data.content_type);
        data.title = data.title || data['item[title]'];
        data.new_tab = data.new_tab ? '1' : '0';
        data.graded = data.graded ? '1' : '0';
        var $item, $olditem = (data.id !== 'new') ? $('#context_module_item_' + data.id) : [];
        if ($olditem.length) {
          var $admin = $olditem.find('.ig-admin');
          if ($admin.length) { $admin.detach(); }
          $item = $olditem.clone(true);
          if ($admin.length) {
            $item.find('.ig-row').append($admin)
          }
        } else {
          $item = $('#context_module_item_blank').clone(true).removeAttr('id');
          modules.evaluateItemCyoe($item, data)
        }
        $item.addClass(data.type + '_' + data.id);
        $item.addClass(data.type);
        if (data.is_duplicate_able) {
          $item.addClass('dupeable')
        }
        $item.attr('aria-label', data.title);
        $item.find('.title').attr('title', data.title);
        $item.fillTemplateData({
          data: data,
          id: 'context_module_item_' + data.id,
          hrefValues: ['id', 'context_module_id', 'content_id']
        });
        for (var idx = 0; idx < 10; idx++) {
          $item.removeClass('indent_' + idx);
        }
        $item.addClass('indent_' + (data.indent || 0));
        $item.addClass(modules.itemClass(data));

        // don't just tack onto the bottom, put it in its correct position
        var $before = null;
        $module.find('.context_module_items').children().each(function() {
          var position = parseInt($(this).getTemplateData({textValues: ['position']}).position, 10);
          if ((data.position || data.position === 0) && (position || position === 0)) {
            if ($before == null && (position - data.position >= 0)) {
              $before = $(this);
            }
          }
        });
        if ($olditem.length) {
          $olditem.replaceWith($item.show());
        } else {
          if (!$before) {
            $module.find('.context_module_items').append($item.show());
          } else {
            $before.before($item.show());
          }
        }
        refreshDuplicateLinkStatus($module);
        return $item;
      },

      evaluateItemCyoe: function($item, data) {
        if (!CyoeHelper.isEnabled()) return;
        $item = $($item)
        var $itemData = $item.find('.publish-icon')
        var $admin = $item.find('.ig-admin')

        data = data || {
          id: $itemData.attr('data-module-item-id'),
          title: $itemData.attr('data-module-item-name'),
          assignment_id: $itemData.attr('data-assignment-id'),
          is_cyoe_able: $itemData.attr('data-is-cyoeable') === 'true'
        }

        var cyoe = CyoeHelper.getItemData(data.assignment_id, data.is_cyoe_able)

        if (cyoe.isReleased) {
          var fullText = I18n.t('Released by Mastery Path: %{path}', { path: cyoe.releasedLabel })
          var $pathIcon = $('<span class="pill mastery-path-icon" aria-hidden="true" data-tooltip><i class="icon-mastery-path" /></span>')
            .attr('title', fullText)
            .append(htmlEscape(cyoe.releasedLabel))
          var $srPath = $('<span class="screenreader-only">')
            .append(htmlEscape(fullText))
          $admin.prepend($srPath)
          $admin.prepend($pathIcon)
        }

        if (cyoe.isCyoeAble) {
          var $mpLink = $('<a class="mastery_paths_link" />')
            .attr('href', ENV.CONTEXT_URL_ROOT +
                          '/modules/items/' +
                          data.id +
                          '/edit_mastery_paths?return_to=' +
                          encodeURIComponent(window.location.pathname))
            .attr('title', I18n.t('Edit Mastery Paths for %{title}', { title: data.title }))
            .text(I18n.t('Mastery Paths'))

          if (cyoe.isTrigger) {
            $admin.prepend($mpLink.clone())
          }

          $admin.find('.delete_link').parent().before(
            $('<li role="presentation" />').append($mpLink.prepend('<i class="icon-mastery-path" /> '))
          )
        }
      },

      getNextPosition: function($module) {
        var maxPosition = 0;
        $module.find(".context_module_items").children().each(function() {
          var position = parseInt($(this).getTemplateData({textValues: ['position']}).position, 10);
          if (position > maxPosition)
            maxPosition = position;
        });
        return maxPosition + 1;
      },
      refreshModuleList: function() {
        $("#module_list").find(".context_module_option").remove();
        $("#context_modules .context_module").each(function() {
          var $this = $(this);
          var data = $this.find(".header").getTemplateData({textValues: ['name']});
          data.id = $this.find(".header").attr('id');
          $this.find('.name').attr('title', data.name);
          var $option = $(document.createElement('option'));
          $option.val(data.id);

          // data.id could come back as undefined, so calling $option.val(data.id) would return an "", which is not chainable, so $option.val(data.id).text... would die.
          $option.attr('role', 'option')
                 .text(data.name)
                 .addClass('context_module_' + data.id)
                 .addClass('context_module_option');

          $("#module_list").append($option);
        });
      },
      filterPrerequisites: function($module, prerequisites) {
        var list = modules.prerequisites();
        var id = $module.attr('id').substring('context_module_'.length);
        var res = [];
        for(var idx in prerequisites) {
          if($.inArray(prerequisites[idx], list[id]) == -1) {
            res.push(prerequisites[idx]);
          }
        }
        return res;
      },
      prerequisites: function() {
        var result = {
          to_visit: {},
          visited: {}
        };
        $("#context_modules .context_module").each(function() {
          var id = $(this).attr('id').substring('context_module_'.length);
          result[id] = [];
          $(this).find(".prerequisites .criterion").each(function() {
            var pre_id = $(this).getTemplateData({textValues: ['id']}).id;
            if($(this).hasClass('context_module_criterion')) {
              result[id].push(pre_id);
              result.to_visit[id + "_" + pre_id] = true;
            }
          });
        });

        for (var val in result.to_visit) {
          if (result.to_visit.hasOwnProperty(val)) {
            var ids = val.split("_");
            if ( result.visited[val] ) {
              continue;
            }
            result.visited[val] = true;
            for(var jdx in result[ids[1]]) {
              result[ids[0]].push(result[ids[1]][jdx]);
              result.to_visit[ids[0] + "_" + result[ids[1]][jdx]] = true;
            }
          }
        }
        delete result['to_visit'];
        delete result['visited'];
        return result;
      },
      updateProgressionState: function($module) {
        var id = $module.attr('id').substring(15);
        var $progression = $("#current_user_progression_list .progression_" + id);
        var data = $progression.getTemplateData({textValues: ['context_module_id', 'workflow_state', 'collapsed', 'current_position']});
        var $module = $("#context_module_" + data.context_module_id);
        var progression_state = data.workflow_state
        var progression_state_capitalized = progression_state && progression_state.charAt(0).toUpperCase() + progression_state.substring(1);

        $module.addClass(progression_state);

        // Locked tooltip title is added in _context_module_next.html.erb
        if (progression_state != 'locked' && progression_state != 'unlocked') {
          $module.find('.completion_status i:visible').attr('title', progression_state_capitalized);
        }

        if (progression_state == "completed" && !$module.find(".progression_requirement").length) {
          // this means that there were no requirements so even though the workflow_state says completed, dont show "completed" because there really wasnt anything to complete
          progression_state = "";
        }
        $module.fillTemplateData({data: {progression_state: progression_state}});

        var reqs_met = $progression.data('requirements_met');
        if (reqs_met == null) {
          reqs_met = [];
        }

        var incomplete_reqs = $progression.data('incomplete_requirements');
        if (incomplete_reqs == null) {
          incomplete_reqs = [];
        }

        $module.find(".context_module_item").each(function() {
          var $mod_item = $(this);
          var position = parseInt($mod_item.getTemplateData({textValues: ['position']}).position, 10);
          if (data.current_position && position && data.current_position < position) {
            $mod_item.addClass('after_current_position');
          }
          // set the status icon
          var $icon_container = $mod_item.find('.module-item-status-icon');
          var mod_id = $mod_item.getTemplateData({textValues: ['id']}).id;

          var completed = _.some(reqs_met, req => req.id == mod_id && $mod_item.hasClass(req.type + "_requirement"));
          if (completed)  {
            $mod_item.addClass('completed_item');
            addIcon($icon_container, 'icon-check', I18n.t('Completed'));
          } else if (progression_state == 'completed') {
            // if it's already completed then don't worry about warnings, etc
            if ($mod_item.hasClass('progression_requirement')) {
              addIcon($icon_container, 'no-icon', I18n.t('Not completed'));
            }
          } else if ($mod_item.data('past_due') != null) {
            addIcon($icon_container, 'icon-minimize', I18n.t('This assignment is overdue'));
          } else {
            var incomplete_req = null;
            for (var idx in incomplete_reqs) {
              if (incomplete_reqs[idx].id == mod_id) {
                incomplete_req = incomplete_reqs[idx];
              }
            }
            if (incomplete_req) {
              if (incomplete_req.score != null) {
                // didn't score high enough
                addIcon($icon_container, 'icon-minimize',
                  I18n.t("You scored a %{score}.", {'score': incomplete_req.score}) + " " + criterionMessage($mod_item) + ".");
              } else {
                // hasn't been scored yet
                addIcon($icon_container, 'icon-info', I18n.t("Your submission has not been graded yet"));
              }
            } else {
              if ($mod_item.hasClass('progression_requirement')) {
                addIcon($icon_container, 'icon-mark-as-read', criterionMessage($mod_item));
              }
            }
          }
        });
        if(data.collapsed == 'true') {
          $module.addClass('collapsed_module');
        }
      },
      sortable_module_options: {
        connectWith: '.context_module_items',
        handle: '.move_item_link',
        helper: 'clone',
        placeholder: 'context_module_placeholder',
        forcePlaceholderSize: true,
        axis: 'y',
        containment: '#content'
      },
      initMasterCourseLockButton: function ($item, tagRestriction) {
        // add the lock button|icon
        var $lockCell = $item.find('.lock-icon');
        var data = $($lockCell).data() || {};

        var isMasterCourseMasterContent = !!('moduleItemId' in data && ENV.MASTER_COURSE_SETTINGS.IS_MASTER_COURSE);
        var isMasterCourseChildContent = !!('moduleItemId' in data && ENV.MASTER_COURSE_SETTINGS.IS_CHILD_COURSE);
        var restricted = !!('moduleItemId' in data && Object.keys(tagRestriction).some(r => tagRestriction[r]));

        var model = new MasterCourseModuleLock({
          is_master_course_master_content: isMasterCourseMasterContent,
          is_master_course_child_content: isMasterCourseChildContent,
          restricted_by_master_course: restricted
        });

        var viewOptions = {
          model: model,
          el: $lockCell[0],
          course_id: ENV.COURSE_ID,
          content_type: data.moduleType,
          content_id: data.contentId
        };

        var view = new LockIconView(viewOptions);
        view.render();
      }
    };
  })();

  var addIcon = function($icon_container, css_class, message) {
    var $icon = $("<i data-tooltip></i>");
    $icon.attr('class', css_class).attr('title', message).attr('aria-label', message);
    $icon_container.empty().append($icon);
  }

  var criterionMessage = function($mod_item) {
    if ($mod_item.hasClass('must_submit_requirement')) {
      return I18n.t('Must submit the assignment');
    } else if ($mod_item.hasClass('must_mark_done_requirement')) {
      return I18n.t('Must mark as done');
    } else if ($mod_item.hasClass('must_view_requirement')) {
      return I18n.t('Must view the page');
    } else if ($mod_item.hasClass('min_contribute_requirement')) {
      return I18n.t('Must contribute to the page');
    } else if ($mod_item.hasClass('min_score_requirement')) {
      return I18n.t('Must score at least a %{score}', { 'score': $mod_item.getTemplateData({textValues: ['min_score']}).min_score});
    } else {
      return I18n.t('Not yet completed')
    }
  }

  var updatePrerequisites = function($module, prereqs) {
    var $prerequisitesDiv = $module.find(".prerequisites");
    var prereqsList = '';
    $prerequisitesDiv.empty();

    if (prereqs.length > 0) {
      for(var i in prereqs) {
        var $div = $('<div />', {'class': 'prerequisite_criterion ' + prereqs[i].type + '_criterion', 'style': "float: left;"});
        var $spanID = $('<span />', {text: htmlEscape(prereqs[i].id), 'class': 'id', 'style': "display: none;"});
        var $spanType = $('<span />', {text: htmlEscape(prereqs[i].type), 'class': 'type', 'style': "display: none;"});
        var $spanName = $('<span />', {text: htmlEscape(prereqs[i].name), 'class': 'name', 'style': "display: none;"});
        $div.append($spanID);
        $div.append($spanType);
        $div.append($spanName);
        $prerequisitesDiv.append($div);

        prereqsList += prereqs[i].name + ', ';
      }
      prereqsList = prereqsList.slice(0, -2)
      const $prerequisitesMessage = $('<div />', {text: prerequisitesMessage(prereqsList), 'class': 'prerequisites_message'});
      $prerequisitesDiv.append($prerequisitesMessage);

    }
  }

  // after a module has been updated, update its name as used in other modules' prerequisite lists
  var updateOtherPrerequisites = function(id, name) {
    $('div.context_module .prerequisite_criterion .id').each(function(_, idNode) {
      const $id = $(idNode)
      const prereq_id = $id.text()
      if (prereq_id == id) {
        const $crit = $id.closest('.prerequisite_criterion')
        $crit.find('.name').text(name)
        const $prereqs = $id.closest('.prerequisites')
        const names = $.makeArray($prereqs.find('.prerequisite_criterion .name')).map(el => $(el).text()).join(', ')
        $prereqs.find('.prerequisites_message').text(prerequisitesMessage(names))
      }
    })
  }

  var prerequisitesMessage = function(list) {
    return I18n.t('Prerequisites: %{list}', {list})
  }

  var newPillMessage = function($module, requirement_count) {
    var $message = $module.find('.requirements_message');

    if (requirement_count != 0) {
      var $pill = $('<ul class="pill"><li></li></ul></div>');
      $message.html($pill);
      var $pillMessage = $message.find('.pill li');
      var newPillMessageText = requirement_count === 1 ? I18n.t("Complete One Item") : I18n.t("Complete All Items");
      $pillMessage.text(newPillMessageText);
      $pillMessage.data("requirement-count", requirement_count);
    }
  }

  modules.initModuleManagement = function() {
    // Create the context modules backbone view to manage the publish button.
    var context_modules_view = new ContextModulesView({
      el: $("#content"),
      modules: modules
    });
    var relock_modules_dialog = new RelockModulesDialog();

    var $context_module_unlocked_at = $("#context_module_unlock_at");
    var valCache = '';
    $("#unlock_module_at").change(function() {
      var $this = $(this);
      var $unlock_module_at_details = $(".unlock_module_at_details");
      $unlock_module_at_details.showIf($this.attr('checked'));

      if ($this.attr('checked')) {
        if(!$context_module_unlocked_at.val()){
          $context_module_unlocked_at.val(valCache);
        }
      } else{
        valCache = $context_module_unlocked_at.val();
        $context_module_unlocked_at.val('').triggerHandler('change');
      }
    }).triggerHandler('change');

    // -------- BINDING THE UPDATE EVENT -----------------
    $(".context_module").bind('update', (event, data) => {
      data.context_module.displayed_unlock_at = $.datetimeString(data.context_module.unlock_at);
      data.context_module.unlock_at = $.datetimeString(data.context_module.unlock_at);
      var $module = $("#context_module_" + data.context_module.id);
      $module.attr('aria-label', data.context_module.name);
      $module.find(".header").fillTemplateData({
        data: data.context_module,
        hrefValues: ['id']
      });

      $module.find('.header').attr('id', data.context_module.id);
      $module.find(".footer").fillTemplateData({
        data: data.context_module,
        hrefValues: ['id']
      });

      $module.find(".unlock_details").showIf(data.context_module.unlock_at && Date.parse(data.context_module.unlock_at) > new Date());
      updatePrerequisites($module, data.context_module.prerequisites);
      updateOtherPrerequisites(data.context_module.id, data.context_module.name);

      // Update requirement message pill
      if (data.context_module.completion_requirements.length === 0) {
        $module.find('.requirements_message').empty();
      } else {
        newPillMessage($module, data.context_module.requirement_count);
      }

      $module.find(".context_module_items .context_module_item")
        .removeClass('progression_requirement')
        .removeClass('min_score_requirement')
        .removeClass('max_score_requirement')
        .removeClass('must_view_requirement')
        .removeClass('must_mark_done_requirement')
        .removeClass('must_submit_requirement')
        .removeClass('must_contribute_requirement')
        .find('.criterion').removeClass('defined');

      // Hack. Removing the class here only to re-add it a few lines later if needed.
      $module.find('.ig-row').removeClass('with-completion-requirements');
      for(var idx in data.context_module.completion_requirements) {
        var req = data.context_module.completion_requirements[idx];
        req.criterion_type = req.type;
        var $item = $module.find("#context_module_item_" + req.id);
        $item.find('.ig-row').addClass('with-completion-requirements');
        $item.find(".criterion").fillTemplateData({data: req});
        $item.find(".completion_requirement").fillTemplateData({data: req});
        $item.find(".criterion").addClass('defined');
        $item.find(".module-item-status-icon").show();
        $item.addClass(req.type + "_requirement").addClass('progression_requirement');
      }

      modules.refreshModuleList();
    });

    $("#add_context_module_form").formSubmit({
      object_name: 'context_module',
      required: ['name'],
      processData: function(data) {
        var prereqs = [];
        $(this).find(".prerequisites_list .criteria_list .criterion").each(function() {
          var id = $(this).find(".option select").val();
          if(id) {
            prereqs.push("module_" + id);
          }
        });

        data['context_module[prerequisites]'] = prereqs.join(",");
        data['context_module[completion_requirements][none]'] = "none";

        var $requirementsList = $(this).find(".completion_entry .criteria_list .criterion");
        $requirementsList.each(function() {
          var id = $(this).find(".id").val();
          data["context_module[completion_requirements][" + id + "][type]"] = $(this).find(".type").val();
          data["context_module[completion_requirements][" + id + "][min_score]"] = $(this).find(".min_score").val();
        });

        var requirementCount = $('input[name="context_module[requirement_count]"]:checked').val();
        data['context_module[requirement_count]'] = requirementCount;

        return data;
      },
      beforeSubmit: function(data) {
        var $module = $(this).data('current_module');
        $module.loadingImage();
        $module.find(".header").fillTemplateData({
          data: data
        });
        $module.addClass('dont_remove');
        modules.hideEditModule();
        $module.removeClass('dont_remove');
        return $module;
      },
      success: function(data, $module) {
        $module.loadingImage('remove');
        $module.attr('id', 'context_module_' + data.context_module.id);
        setupContentIds($module, data.context_module.id);

        // Set this module up with correct data attributes
        $module.data('moduleId', data.context_module.id);
        $module.data('module-url', "/courses/" + data.context_module.context_id + "/modules/" + data.context_module.id + "items?include[]=content_details");
        $module.data('workflow-state', data.context_module.workflow_state);
        if(data.context_module.workflow_state == "unpublished"){
          $module.find('.workflow-state-action').text("Publish");
          $module.find('.workflow-state-icon').addClass('publish-module-link')
                                              .removeClass('unpublish-module-link');
          $module.addClass('unpublished_module');
        }

        $("#no_context_modules_message").slideUp();
        var $publishIcon = $module.find('.publish-icon');
        // new module, setup publish icon and other stuff
        if (!$publishIcon.data('id')) {
          var fixLink = function(locator, attribute) {
              var el = $module.find(locator);
              el.attr(attribute, el.attr(attribute).replace('{{ id }}', data.context_module.id));
          }
          fixLink('span.collapse_module_link', 'href');
          fixLink('span.expand_module_link', 'href');
          fixLink('.add_module_item_link', 'rel');
          fixLink('.add_module_item_link', 'rel');
          var publishData = {
            moduleType: 'module',
            id: data.context_module.id,
            courseId: data.context_module.context_id,
            published: data.context_module.workflow_state == 'published',
            publishable: true
          };
          var view = initPublishButton($publishIcon, publishData);
          overrideModel(view.model, view);
        }
        relock_modules_dialog.renderIfNeeded(data.context_module);
        $module.triggerHandler('update', data);
      },
      error: function(data, $module) {
        $module.loadingImage('remove');
      }
    });

    $("#add_context_module_form .add_prerequisite_link").click(function(event) {
      event.preventDefault();
      var $form = $(this).parents("#add_context_module_form");
      var $module = $form.data('current_module');
      var $select = $("#module_list").clone(true).removeAttr('id');
      var $pre = $form.find("#criterion_blank_prereq").clone(true).removeAttr('id');
      $select.find("." + $module.attr('id')).remove();
      var afters = [];

      $("#context_modules .context_module").each(function() {
        if($(this)[0] == $module[0] || afters.length > 0) {
          afters.push($(this).attr('id'));
        }
      });
      for(var idx in afters) {
        $select.find("." + afters[idx]).hide();
      }

      $select.attr('id', 'module_list_prereq')
      $pre.find(".option").empty().append($select.show());
      $('<label for="module_list_prereq" class="screenreader-only" />').text(I18n.t('Select prerequisite module')).insertBefore($select);
      $form.find(".prerequisites_list .criteria_list").append($pre).show();
      $pre.show();
      $select.change(event => {
        const $target = $(event.target)
        const title = $target.val() ? $target.find('option:selected').text() : ''
        const $prereq = $target.closest('.criterion')
        const $deleteBtn = $prereq.find('.delete_criterion_link')
        $deleteBtn.attr('aria-label', I18n.t('Delete prerequisite %{title}', { title }))
      })
      $select.focus();
    });

    $("#add_context_module_form .add_completion_criterion_link").click(function(event) {
      event.preventDefault();
      var $form = $(this).parents("#add_context_module_form");
      var $module = $form.data('current_module');
      var $option = $("#completion_criterion_option").clone(true).removeAttr('id');
      var $select = $option.find("select.id");
      var $pre = $form.find("#criterion_blank_req").clone(true).removeAttr('id');
      $pre.find(".prereq_desc").remove();
      var prereqs = modules.prerequisites();
      var $optgroups = {};
      $module.find(".content .context_module_item").not('.context_module_sub_header').each(function() {
        var displayType;
        var data = $(this).getTemplateData({textValues: ['id', 'type']});
        data.title = $(this).find('.title').attr('title');
        if (data.type == 'assignment') {
          displayType = I18n.t('optgroup.assignments', "Assignments");
        } else if (data.type == 'attachment') {
          displayType = I18n.t('optgroup.files', "Files");
        } else if (data.type == 'quiz') {
          displayType = I18n.t('optgroup.quizzes', "Quizzes");
        } else if (data.type == 'external_url') {
          displayType = I18n.t('optgroup.external_urls', "External URLs");
        } else if (data.type == 'context_external_tool') {
          displayType = I18n.t('optgroup.external_tools', "External Tools");
        } else if (data.type == 'discussion_topic') {
          displayType = I18n.t('optgroup.discussion_topics', "Discussions");
        } else if (data.type == 'wiki_page') {
          displayType = I18n.t("Pages");
        }
        var $group = $optgroups[displayType]
        if (!$group) {
          $group = $optgroups[displayType] = $(document.createElement('optgroup'))
          $group.attr('label', displayType)
          $select.append($group)
        }
        var titleDesc = data.title;
        var $option = $(document.createElement('option'));
        $option.val(data.id).text(titleDesc);
        $group.append($option);
      });
      $pre.find(".option").empty().append($option);
      $option.find(".id").change();
      $option.slideDown(function() {
        if (event.originalEvent) { // don't do this when populating the dialog :P
          $("select:first", $(this)).focus();
        }
      });
      $form.find(".completion_entry .criteria_list").append($pre).show();
      $pre.slideDown();
      $(".requirement-count-radio").show();
      $('#context_module_requirement_count_').change()
    });
    $("#completion_criterion_option .id").change(function() {
      var $option = $(this).parents(".completion_criterion_option");
      var data = $("#context_module_item_" + $(this).val()).getTemplateData({textValues: ['type', 'graded']});
      $option.find(".type option").hide().attr('disabled', true).end()
        .find(".type option.any").show().attr('disabled', false).end()
        .find(".type option." + data.type).show().attr('disabled', false);
      if (data.graded == '1') {
        $option.find(".type option.graded").show().attr('disabled', false);
      }
      $option.find(".type").val($option.find(".type option." + data.criterion_type + ":first").val())
      $option.find(".type").change();
    });
    $("#completion_criterion_option .type").change(function() {
      var $option = $(this).parents(".completion_criterion_option");

      // Show score text box and do some resizing of drop down to get it to stay on one line
      $option.find(".min_score_box").showIf($(this).val() == 'min_score');

      var id = $option.find(".id").val();
      var points_possible = $.trim($("#context_module_item_" + id + " .points_possible_display").text().split(' ')[0]);
      if(points_possible.length > 0 && $(this).val() == 'min_score') {
        $option.find(".points_possible").text(points_possible);
        $option.find(".points_possible_parent").show();
      } else {
        $option.find(".points_possible_parent").hide();
      }

      const itemName = $option.find('.id option:selected').text()
      const reqType = $option.find('.type option:selected').text()
      $option.closest('.criterion').find('.delete_criterion_link').attr('aria-label', I18n.t('Delete requirement %{item} (%{type})', { item: itemName, type: reqType }))
    });

    $("#add_context_module_form .requirement-count-radio .ic-Radio input").change(() => {
      if ($('#context_module_requirement_count_').prop('checked')) {
        $('.require-sequential').show();
      } else {
        $('.require-sequential').hide();
        $('#require_sequential_progress').prop('checked', false)
      }
    });

    $("#add_context_module_form .delete_criterion_link").click(function(event) {
      event.preventDefault();
      var $elem = $(this).closest(".criteria_list");
      var $requirement = $(this).parents('.completion_entry');
      var $criterion = $(this).closest(".criterion");
      var $prevCriterion = $criterion.prev();
      var $toFocus = $prevCriterion.length ?
        $(".delete_criterion_link", $prevCriterion) :
        $(".add_prerequisite_or_requirement_link", $(this).closest(".form-section"));
      $criterion.slideUp(function() {
        $(this).remove();
        // Hides radio button and checkbox if there are no requirements
        if ($elem.html().length === 0 && $requirement.length !== 0) {
          $(".requirement-count-radio").fadeOut("fast");
        }
        $toFocus.focus();
      })
    });

    $(".duplicate_module_link").live('click', function(event) {
      event.preventDefault()
      const duplicateRequestUrl = $(this).attr('href')
      const duplicatedModuleElement = $(this).parents(".context_module")
      const spinner = <ModuleDuplicationSpinner />
      const $tempElement = $('<div id="temporary-spinner" class="item-group-condensed"></div>')
      $tempElement.insertAfter(duplicatedModuleElement)
      ReactDOM.render(spinner, $('#temporary-spinner')[0])
      $.screenReaderFlashMessage(I18n.t('Duplicating Module, this may take some time'))
      const renderDuplicatedModule = function(response) {

        response.data.ENV_UPDATE.forEach((newAttachmentItem) => {
          ENV.MODULE_FILE_DETAILS[newAttachmentItem.id] = newAttachmentItem
        });
        const newModuleId = response.data.context_module.id
        // This is terrible but then so is the whole file so it fits in
        const contextId = response.data.context_module.context_id
        const modulesPage = `/courses/${contextId}/modules`
        axios.get(modulesPage).then((getResponse) => {
          const $newContent = $(getResponse.data)
          const $newModule = $newContent.find(`#context_module_${newModuleId}`)
          $tempElement.remove()
          $newModule.insertAfter(duplicatedModuleElement)
          $newModule.find('.collapse_module_link').focus()
          modules.updateAssignmentData()
          // Without these 'die' commands, the event handler happens twice after
          // initModuleManagement is called.
          $('.delete_module_link').die()
          $('.duplicate_module_link').die()
          $('.duplicate_item_link').die()
          $('.add_module_link').die()
          $('.edit_module_link').die()
          $("#add_context_module_form .add_prerequisite_link").off()
          $('#add_context_module_form .add_completion_criterion_link').off()
          $(".context_module").find(".expand_module_link,.collapse_module_link").bind('click keyclick', toggleModuleCollapse)
          modules.initModuleManagement()
        }).catch(showFlashError(I18n.t('Error rendering duplicated module')))
      }

      axios.post(duplicateRequestUrl, {})
        .then(renderDuplicatedModule)
        .catch(showFlashError(I18n.t('Error duplicating module')))
    });

    $(".delete_module_link").live('click', function(event) {
      event.preventDefault();
      $(this).parents(".context_module").confirmDelete({
        url: $(this).attr('href'),
        message: I18n.t('confirm.delete', "Are you sure you want to delete this module?"),
        cancelled: function() {
          $('.ig-header-admin .al-trigger', $(this)).focus();
        },
        success: function(data) {
          var id = data.context_module.id;
          $(".context_module .prerequisites .criterion").each(function() {
            var criterion = $(this).getTemplateData({textValues: ['id', 'type']});
            if(criterion.type == 'context_module' && criterion.id == id) {
              $(this).remove();
            }
          });
          var $prevModule = $(this).prev();
          var $addModuleButton = $("#content .header-bar .add_module_link");
          var $toFocus = $prevModule.length ? $(".ig-header-admin .al-trigger", $prevModule) : $addModuleButton;
          $(this).slideUp(function() {
            $(this).remove();
            modules.updateTaggedItems();
            $toFocus.focus();
          });
          $.flashMessage(I18n.t("Module %{module_name} was successfully deleted.", {module_name: data.context_module.name}));
        }
      });
    });
    $(".outdent_item_link,.indent_item_link").live('click', function(event, elem, activeElem) {
      event.preventDefault();
      var $elem = $(elem);
      var elemID = ( $elem && $elem.attr('id') ) ? "#" + $elem.attr('id') : elem && "." + $elem.attr('class');
      var $cogLink = $(this).closest('.cog-menu-container').children('.al-trigger');
      var do_indent = $(this).hasClass('indent_item_link');
      var $item = $(this).parents(".context_module_item");
      var indent = modules.currentIndent($item);
      indent = Math.max(Math.min(indent + (do_indent ? 1 : -1), 5), 0);
      $item.loadingImage({image_size: 'small'});
      $.ajaxJSON($(this).attr('href'), "PUT", {'content_tag[indent]': indent}, data => {
        $item.loadingImage('remove');
        var $module = $("#context_module_" + data.content_tag.context_module_id);
        modules.addItemToModule($module, data.content_tag);
        $module.find(".context_module_items.ui-sortable").sortable('refresh');
        modules.updateAssignmentData();

      }, data => {
      }).done (() => {
        if (elemID) {
          setTimeout(() => {;
            var $activeElemClass = "." + $(activeElem).attr('class').split(' ').join(".");
            $(elemID).find($activeElemClass).focus();
          }, 0);

        } else {
          $cogLink.focus();
        }
      })

    });
    $(".edit_item_link").live('click', function(event) {
      event.preventDefault();
      var $cogLink = $(this).closest('.cog-menu-container').children('.al-trigger');
      var $item = $(this).parents(".context_module_item");
      var data = $item.getTemplateData({textValues: ['url', 'indent', 'new_tab']});
      data.title = $item.find('.title').attr('title');
      data.indent = modules.currentIndent($item);
      $("#edit_item_form").find(".external").showIf($item.hasClass('external_url') || $item.hasClass('context_external_tool'));
      $("#edit_item_form").attr('action', $(this).attr('href'));
      $("#edit_item_form").fillFormData(data, {object_name: 'content_tag'});

      var $titleInput = $('#edit_item_form #content_tag_title');
      var restrictions = $item.data().master_course_restrictions;
      var isDisabled = !get(ENV, 'MASTER_COURSE_SETTINGS.IS_MASTER_COURSE') && !!get(restrictions, 'content');
      $titleInput.attr('disabled', isDisabled);

      $("#edit_item_form").dialog({
        title: I18n.t('titles.edit_item', "Edit Item Details"),
        close: function () {
          $("#edit_item_form").hideErrors();
           $cogLink.focus();
        },
        minWidth: 320
      }).fixDialogButtons();
    });
    $("#edit_item_form .cancel_button").click(event => {
      $("#edit_item_form").dialog('close');
    });
    $("#edit_item_form").formSubmit({
      beforeSubmit: function(data) {
        if (data["content_tag[title]"] == '') {
          $('#content_tag_title').errorBox(I18n.t("Title is required"));
          return false;
        }
        $(this).loadingImage();
      },
      success: function(data) {
        $(this).loadingImage('remove');
        var $module = $("#context_module_" + data.content_tag.context_module_id);
        var $item = modules.addItemToModule($module, data.content_tag);
        $module.find(".context_module_items.ui-sortable").sortable('refresh');
        if (data.content_tag.content_id != 0 && data.content_tag.content_type != 'ContextExternalTool') {
          modules.updateAllItemInstances(data.content_tag);
        }
        modules.updateAssignmentData();
        $(this).dialog('close');
      },
      error: function(data) {
        $(this).loadingImage('remove');
        $(this).formErrors(data);
      }
    });

    $(".delete_item_link").live('click', function(event) {
      event.preventDefault();
      var $currentCogLink = $(this).closest('.cog-menu-container').children('.al-trigger');
      // Get the previous cog item to focus after delete
      var $allInCurrentModule = $(this).parents('.context_module_items').children()
      var $currentModule = $(this).parents('.context_module');
      var curIndex = $allInCurrentModule.index($(this).parents('.context_module_item'));
      var newIndex = curIndex - 1;
        // Skip over headers, since they are not actionable
      var $placeToFocus
      if (newIndex >= 0) {
        const prevItem = $allInCurrentModule[newIndex]
        if ($(prevItem).hasClass('context_module_sub_header')) {
          $placeToFocus = $(prevItem).find('.cog-menu-container .al-trigger')
        } else {
          $placeToFocus = $(prevItem).find('.item_link')
        }
      } else {
        // Focus on the module cog since there are not more module item cogs
        $placeToFocus = $(this).closest('.editable_context_module').find('button.al-trigger')
      }
      $(this).parents(".context_module_item").confirmDelete({
        url: $(this).attr('href'),
        message: I18n.t('confirm.delete_item', 'Are you sure you want to remove this item from the module?'),
        success: function(data) {
          $(this).slideUp(function() {
            $(this).remove();
            modules.updateTaggedItems();
            $placeToFocus.focus();
            refreshDuplicateLinkStatus($currentModule);
          });
          $.flashMessage(I18n.t("Module item %{module_item_name} was successfully deleted.", {module_item_name: data.content_tag.title}));
        },
        cancelled: function () {
          $currentCogLink.focus();
        }
      });
    });

    $('.move_module_item_link').on('click keyclick', function (event) {
      event.preventDefault()

      const currentItem = $(this).parents('.context_module_item')[0]
      const modules = document.querySelectorAll('#context_modules .context_module')
      const groups = Array.prototype.map.call(modules, module => {
        const id = module.getAttribute('id').substring('context_module_'.length)
        const title = module.querySelector('.header > .collapse_module_link > .name').textContent
        const moduleItems = module.querySelectorAll('.context_module_item')
        const items = Array.prototype.map.call(moduleItems, item => ({
          id: item.getAttribute('id').substring('context_module_item_'.length),
          title: item.querySelector('.title').textContent.trim(),
        }))
        return { id, title, items }
      })

      const moveTrayProps = {
        title: I18n.t('Move Module Item'),
        items: [{
          id:  currentItem.getAttribute('id').substring('context_module_item_'.length),
          title: currentItem.querySelector('.title').textContent.trim(),
        }],
        moveOptions: {
          groupsLabel: I18n.t('Modules'),
          groups,
        },
        formatSaveUrl: ({ groupId }) => `${ENV.CONTEXT_URL_ROOT}/modules/${groupId}/reorder`,
        onMoveSuccess: ({ data, itemIds, groupId }) => {
          const itemId = itemIds[0]
          const $container = $(`#context_module_${groupId} .ui-sortable`)
          $container.sortable('disable')

          const item = document.querySelector(`#context_module_item_${itemId}`)
          $container[0].appendChild(item)

          const order = data.context_module.content_tags.map(item => item.content_tag.id)
          reorderElements(order, $container[0], id => `#context_module_item_${id}`)
          $container.sortable('enable').sortable('refresh')
        },
        focusOnExit: () => currentItem.querySelector('.al-trigger'),
      }

      renderTray(moveTrayProps, document.getElementById('not_right_side'))
    })

    $('.move_module_link').on('click keyclick', function (event) {
      event.preventDefault()

      const currentModule = $(this).parents('.context_module')[0]
      const modules = document.querySelectorAll('#context_modules .context_module')
      const siblings = Array.prototype.map.call(modules, module => {
        const id = module.getAttribute('id').substring('context_module_'.length)
        const title = module.querySelector('.header > .collapse_module_link > .name').textContent
        return { id, title }
      })

      const moveTrayProps = {
        title: I18n.t('Move Module'),
        items: [{
          id:  currentModule.getAttribute('id').substring('context_module_'.length),
          title: currentModule.querySelector('.header > .collapse_module_link > .name').textContent,
        }],
        moveOptions: { siblings },
        formatSaveUrl: () => `${ENV.CONTEXT_URL_ROOT}/modules/reorder`,
        onMoveSuccess: res => {
          const container = document.querySelector('#context_modules.ui-sortable')
          reorderElements(res.data.map(item => item.context_module.id), container, (id) => `#context_module_${id}`)
          $(container).sortable('refresh')
        },
        focusOnExit: () => currentModule.querySelector('.al-trigger'),
      }

      renderTray(moveTrayProps, document.getElementById('not_right_side'))
    })

    $('.move_module_contents_link').on('click keyclick', function (event) {
      event.preventDefault()

      const currentModule = $(this).parents('.context_module')[0]
      const modules = document.querySelectorAll('#context_modules .context_module')
      const groups = Array.prototype.map.call(modules, module => {
        const id = module.getAttribute('id').substring('context_module_'.length)
        const title = module.querySelector('.header > .collapse_module_link > .name').textContent
        const moduleItems = module.querySelectorAll('.context_module_item')
        const items = Array.prototype.map.call(moduleItems, item => ({
          id: item.getAttribute('id').substring('context_module_item_'.length),
          title: item.querySelector('.title').textContent.trim(),
        }))
        return { id, title, items }
      })
      const moduleItems = currentModule.querySelectorAll('.context_module_item')
      const items = Array.prototype.map.call(moduleItems, item => ({
        id: item.getAttribute('id').substring('context_module_item_'.length),
        title: item.querySelector('.title').textContent.trim(),
      }))
      if (items.length === 0) {
        return
      }
      items[0].groupId = currentModule.getAttribute('id').substring('context_module_'.length)

      const moveTrayProps = {
        title: I18n.t('Move Contents Into'),
        items,
        moveOptions: {
          groupsLabel: I18n.t('Modules'),
          groups,
          excludeCurrent: true
        },
        formatSaveUrl: ({ groupId }) => `${ENV.CONTEXT_URL_ROOT}/modules/${groupId}/reorder`,
        onMoveSuccess: ({ data, itemIds, groupId }) => {
          const $container = $(`#context_module_${groupId} .ui-sortable`)
          $container.sortable('disable')

          itemIds.forEach((id) => {
            const item = document.querySelector(`#context_module_item_${id}`)
            $container[0].appendChild(item)
          })

          const order = data.context_module.content_tags.map(item => item.content_tag.id)
          reorderElements(order, $container[0], id => `#context_module_item_${id}`)

          $container.sortable('enable').sortable('refresh')
        },
        focusOnExit: () => currentModule.querySelector('.al-trigger'),
      }

      renderTray(moveTrayProps, document.getElementById('not_right_side'))
    })

    $('.drag_and_drop_warning').on('focus', event => {
      $(event.currentTarget).removeClass('screenreader-only');
    })

    $('.drag_and_drop_warning').on('blur', event => {
      $(event.currentTarget).addClass('screenreader-only');
    })

    $(".edit_module_link").live('click', function(event) {
      event.preventDefault()
      modules.editModule($(this).parents(".context_module"))
    });

    $(".add_module_link").live('click', event => {
      event.preventDefault();
      modules.addModule();
    });

    $(".add_module_item_link").on('click', function(event) {
      event.preventDefault();
      var $trigger = $(event.currentTarget);
      $trigger.blur();
      var $module = $(this).closest(".context_module");
      if($module.hasClass('collapsed_module')) {
        $module.find(".expand_module_link").triggerHandler('click', () => {
          $module.find(".add_module_item_link").click();
        });
        return;
      }
      if(INST && INST.selectContentDialog) {
        var id = $(this).parents(".context_module").find(".header").attr("id");
        var name = $(this).parents(".context_module").find(".name").attr("title");
        var options = {for_modules: true};
        options.select_button_text = I18n.t('buttons.add_item', "Add Item");
        options.holder_name = name;
        options.height = 550;
        options.width = 770;
        options.dialog_title = I18n.t('titles.add_item', "Add Item to %{module}", {'module': name});
        options.close = function () {
          $trigger.focus();
        };
        var nextPosition = modules.getNextPosition($module);
        options.submit = function(item_data) {
          item_data.content_details = ['items']
          item_data['item[position]'] = nextPosition++;
          var $module = $("#context_module_" + id);
          var $item = modules.addItemToModule($module, item_data);
          $module.find(".context_module_items.ui-sortable").sortable('refresh').sortable('disable');
          var url = $module.find(".add_module_item_link").attr('rel');
          $module.disableWhileLoading(
            $.ajaxJSON(url, 'POST', item_data, data => {
              $item.remove();
              data.content_tag.type = item_data['item[type]'];
              $item = modules.addItemToModule($module, data.content_tag);
              $module.find(".context_module_items.ui-sortable").sortable('enable').sortable('refresh');
              initNewItemPublishButton($item, data.content_tag);
              modules.updateAssignmentData();

              $item.find('.lock-icon').data({
                moduleType: data.content_tag.type,
                contentId: data.content_tag.content_id,
                moduleItemId: data.content_tag.id
              });
              modules.loadMasterCourseData(data.content_tag.id);
            }), { onComplete: function() {
              $module.find('.add_module_item_link').focus();
            }}
          );
        };
        INST.selectContentDialog(options);
      }
    })

    $('.duplicate_item_link').live('click', function(event) {
      event.preventDefault()

      const $module = $(this).closest('.context_module')
      const url = $(this).attr('href')

      axios.post(url)
        .then(({ data }) => {
          const $item = modules.addItemToModule($module, data.content_tag)
          initNewItemPublishButton($item, data.content_tag)
          modules.updateAssignmentData()

          $item.find('.lock-icon').data({
            moduleType: data.content_tag.type,
            contentId: data.content_tag.content_id,
            moduleItemId: data.content_tag.id
          });
          modules.loadMasterCourseData(data.content_tag.id)

          $module.find('.context_module_items.ui-sortable').sortable('disable')
          data.new_positions.forEach(({ content_tag }) => {
            $module.find(`#context_module_item_${content_tag.id}`).fillTemplateData({
              data: {position: content_tag.position}
            })
          })
          $(`#context_module_item_${data.content_tag.id} .item_link`).focus()
          $module.find('.context_module_items.ui-sortable').sortable('enable').sortable('refresh')
        })
        .catch(showFlashError('Error duplicating item'))
    })

    $('.module_copy_to').live('click', event => {
      event.preventDefault()
      console.log('copy module to course')
    })

    $('.module_send_to').live('click', event => {
      event.preventDefault()
      console.log('send module to user')
    })

    $('.module_item_copy_to').live('click', event => {
      event.preventDefault()
      console.log('copy module item to course')
    })

    $('.module_item_send_to').live('click', event => {
      event.preventDefault()
      console.log('send module item to user')
    })

    $("#add_module_prerequisite_dialog .cancel_button").click(() => {
      $("#add_module_prerequisite_dialog").dialog('close');
    });

    $(".delete_prerequisite_link").live('click', function(event) {
      event.preventDefault();
      var $criterion = $(this).parents(".criterion");
      var prereqs = []

      $(this).parents(".context_module .prerequisites .criterion").each(function() {
        if($(this)[0] != $criterion[0]) {
          var data = $(this).getTemplateData({textValues: ['id', 'type']});
          var type = data.type == "context_module" ? "module" : data.type;
          prereqs.push(type + "_" + data.id);
        }
      });

      var url = $(this).parents(".context_module").find(".edit_module_link").attr('href');
      var data = {'context_module[prerequisites]': prereqs.join(",")}

      $criterion.dim();

      $.ajaxJSON(url, 'PUT', data, data => {
        $("#context_module_" + data.context_module.id).triggerHandler('update', data);
      });
    });
    $("#add_module_prerequisite_dialog .submit_button").click(function() {
      var val = $("#add_module_prerequisite_dialog .prerequisite_module_select select").val();
      if(!val) { return; }
      $("#add_module_prerequisite_dialog").loadingImage();
      var prereqs = [];
      prereqs.push("module_" + val);
      var $module = $("#context_module_" + $("#add_module_prerequisite_dialog").getTemplateData({textValues: ['context_module_id']}).context_module_id);
      $module.find(".prerequisites .criterion").each(function() {
        prereqs.push("module_" + $(this).getTemplateData({textValues: ['id', 'name', 'type']}).id);
      });
      var url = $module.find(".edit_module_link").attr('href');
      var data = {'context_module[prerequisites]': prereqs.join(",")}
      $.ajaxJSON(url, 'PUT', data, data => {
        $("#add_module_prerequisite_dialog").loadingImage('remove');
        $("#add_module_prerequisite_dialog").dialog('close');
        $("#context_module_" + data.context_module.id).triggerHandler('update', data);
      }, data => {
        $("#add_module_prerequisite_dialog").loadingImage('remove');
        $("#add_module_prerequisite_dialog").formErrors(data);
      });
    });
    $(".context_module .add_prerequisite_link").live('click', function(event) {
      event.preventDefault();
      var module = $(this).parents(".context_module").find(".header").getTemplateData({textValues: ['name', 'id']});
      $("#add_module_prerequisite_dialog").fillTemplateData({
        data: {module_name: module.name, context_module_id: module.id}
      });
      var $module = $(this).parents(".context_module");
      var $select = $("#module_list").clone(true).removeAttr('id');
      $select.find("." + $module.attr('id')).remove();
      var afters = [];
      $("#context_modules .context_module").each(function() {
        if($(this)[0] == $module[0] || afters.length > 0) {
          afters.push($(this).getTemplateData({textValues: ['id']}).id);
        }
      });
      for(var idx in afters) {
        $select.find(".context_module_" + afters[idx]).hide();
      }
      $("#add_module_prerequisite_dialog").find(".prerequisite_module_select").empty().append($select.show());
      $("#add_module_prerequisite_dialog").dialog({
        title: I18n.t('titles.add_prerequisite', 'Add Prerequisite to %{module}', {'module': module.name}),
        width: 400
      });
    });
    $("#add_context_module_form .cancel_button").click(event => {
      modules.hideEditModule(true);
    });
    requestAnimationFrame(function() {
      var $items = [];
      $("#context_modules .context_module_items").each(function() {
        $items.push($(this));
      });
      var next = function() {
        if($items.length > 0) {
          var $item = $items.shift();
          var opts = modules.sortable_module_options;
          opts['update'] = modules.updateModuleItemPositions;
          $item.sortable(opts);
          requestAnimationFrame(next);
        }
      };
      next();
      $("#context_modules").sortable({
        handle: '.reorder_module_link',
        helper: 'clone',
        axis: 'y',
        update: modules.updateModulePositions
      });
      modules.refreshModuleList();
      modules.refreshed = true;
    });

    function initNewItemPublishButton($item, data) {
      var publishData = {
        moduleType: data.type,
        id: data.publishable_id,
        moduleItemName: data.moduleItemName,
        moduleItemId: data.id,
        moduleId: data.context_module_id,
        courseId: data.context_id,
        published: data.published,
        publishable: data.publishable,
        unpublishable: data.unpublishable,
        content_details: data.content_details,
        isNew: true
      };

      var view = initPublishButton($item.find('.publish-icon'), publishData);
      overrideModel(view.model, view);
    }

    var initPublishButton = function($el, data) {
      data = data || $el.data();
      if(data.moduleType == 'attachment'){
        // Module isNew if it was created with an ajax request vs being loaded when the page loads
        var moduleItem = {};

        if (data.isNew){
          // Data will have content_details on the object
          moduleItem = data || {};

          // make sure styles are applied to new module items
          $el.attr('data-module-type', "attachment");
        }else{
          // retrieve preloaded content details for the file item
          moduleItem = ENV.MODULE_FILE_DETAILS[parseInt(data.moduleItemId, 10)];
        }

        // Make sure content_details isn't empty. You don't want to break something.
        moduleItem.content_details = moduleItem.content_details || {};

        var file = new ModuleFile({
            type: 'file',
            id: moduleItem.content_id || moduleItem.id,
            locked: moduleItem.content_details.locked,
            hidden: moduleItem.content_details.hidden,
            unlock_at: moduleItem.content_details.unlock_at,
            lock_at: moduleItem.content_details.lock_at,
            display_name: moduleItem.content_details.display_name,
            thumbnail_url: moduleItem.content_details.thumbnail_url,
            usage_rights: moduleItem.content_details.usage_rights
          });

        file.url = function(){
          return "/api/v1/files/" + this.id;
        }

        var props = {
          model: file,
          togglePublishClassOn: $el.parents('.ig-row')[0],
          userCanManageFilesForContext: ENV.MODULE_FILE_PERMISSIONS.manage_files,
          usageRightsRequiredForContext: ENV.MODULE_FILE_PERMISSIONS.usage_rights_required,
          fileName: file.displayName()
        }

        var Cloud = <PublishCloud {...props} />;
        ReactDOM.render(Cloud, $el[0]);
        return {model: file} // Pretending this is a backbone view
      }

      var model = new PublishableModuleItem({
        module_type: data.moduleType,
        content_id: data.contentId,
        id: data.id,
        module_id: data.moduleId,
        module_item_id: data.moduleItemId,
        module_item_name: data.moduleItemName,
        course_id: data.courseId,
        published: data.published,
        publishable: data.publishable,
        unpublishable: data.unpublishable
      });

      var viewOptions = {
        model: model,
        title: data.publishTitle,
        el: $el[0]
      };


      var view = new PublishIconView(viewOptions);
      var row = $el.closest('.ig-row');

      if (data.published) { row.addClass('ig-published'); }
      // TODO: need to go find this item in other modules and update their state
      view.render();
      return view;
    }

    var moduleItems = {};
    var updateModuleItem = function(attrs, model) {
      var i, items, item, parsedAttrs;
      items = moduleItems[itemContentKey(attrs) || itemContentKey(model)];
      if (items) {
        for (i = 0; i < items.length; i++) {
          item = items[i];
          parsedAttrs = item.model.parse(attrs);
          if (parsedAttrs.type == 'File') {
            item.model.set({locked: !parsedAttrs.published});
          } else {
            item.model.set({published: parsedAttrs.published});
            item.model.view.render();
          }
        }
      }
    };

    var overrideModuleModel = function(model) {
      var publish = model.publish, unpublish = model.unpublish;
      model.publish = function() {
        return publish.apply(model, arguments).done(data => {
          if (data.publish_warning) {
            $.flashWarning(I18n.t('Some module items could not be published'))
          }

          relock_modules_dialog.renderIfNeeded(data);
          model
            .fetch({data: {include: 'items'}})
            .done(attrs => {
              for (var i = 0; i < attrs.items.length; i++)
                updateModuleItem(attrs.items[i], model);
            });
        });
      };
      model.unpublish = function() {
        return unpublish.apply(model, arguments).done(() => {
          model
            .fetch({data: {include: 'items'}})
            .done(attrs => {
              for (var i = 0; i < attrs.items.length; i++)
                updateModuleItem(attrs.items[i], model);
            });
        });
      };
    };
    var overrideItemModel = function(model) {
      var publish = model.publish, unpublish = model.unpublish;
      model.publish = function() {
        return publish.apply(model, arguments).done(attrs => {
          updateModuleItem($.extend({published:true}, attrs), model);
        });
      };
      model.unpublish = function() {
        return unpublish.apply(model, arguments).done(attrs => {
          updateModuleItem($.extend({published:false}, attrs), model);
        });
      };
    };
    var overrideModel = function(model, view) {
      var contentKey = itemContentKey(model);
      if (contentKey === null)
        overrideModuleModel(model);
      else
        overrideItemModel(model);

      moduleItems[contentKey] || (moduleItems[contentKey] = []);
      moduleItems[contentKey].push({model: model, view: view});
    };

    $('.publish-icon').each((index, el) => {
      var $el = $(el);
      if ($el.data('id')) {
        var view = initPublishButton($el);
        overrideModel(view.model, view);
      }
    });

    $('.module-publish-link').each((i, element) => {
      var $el = $(element);
      var model = new Publishable({ published: $el.hasClass('published'), id: $el.attr('data-id') }, { url: $el.attr('data-url'), root: 'module' });
      var view = new PublishButtonView({model: model, el: $el});
      view.render();
    });
  }

  var content_type_map = {
    'page': 'wiki_page',
    'discussion': 'discussion_topic',
    'external_tool': 'context_external_tool',
    'sub_header': 'context_module_sub_header'
  };
  function itemContentKey(model) {
    if (model === null)
      return null;

    var attrs = model.attributes || model,
        content_type = $.underscore(attrs['module_type'] || attrs['type']),
        content_id = attrs['content_id'] || attrs['id'];

    content_type = content_type_map[content_type] || content_type;

    if (!content_type || content_type === 'module') {
      return null;
    } else {
      if (content_type == 'wiki_page') {
        content_type = 'wiki_page';
        content_id = attrs['page_url'] || attrs['id'];
      } else if (content_type === 'context_module_sub_header' || content_type === 'external_url' || content_type == 'context_external_tool') {
        content_id = attrs['id'];
      }

      return content_type + '_' + content_id;
    }
  }

  var toggleModuleCollapse = function(event) {
    event.preventDefault();
    var expandCallback = null;
    var collapse = $(this).hasClass('collapse_module_link') ? '1' : '0';
    var $module = $(this).parents(".context_module");
    var reload_entries = $module.find(".content .context_module_items").children().length === 0;
    var toggle = function(show) {
      var callback = function() {
        $module.find(".collapse_module_link").css('display', $module.find(".content:visible").length > 0 ? 'inline-block' : 'none');
        $module.find(".expand_module_link").css('display', $module.find(".content:visible").length === 0 ? 'inline-block' : 'none');
        if($module.find(".content:visible").length > 0) {
          $module.find(".footer .manage_module").css('display', '');
          $module.toggleClass('collapsed_module', false);
          // Makes sure the resulting item has focus.
          $module.find(".collapse_module_link").focus();
          $.screenReaderFlashMessage(I18n.t('Expanded'));

        } else {
          $module.find(".footer .manage_module").css('display', ''); //'none');
          $module.toggleClass('collapsed_module', true);
          // Makes sure the resulting item has focus.
          $module.find(".expand_module_link").focus();
          $.screenReaderFlashMessage(I18n.t('Collapsed'));
        }
        if(expandCallback && $.isFunction(expandCallback)) {
          expandCallback();
        }
      };
      if(show) {
        $module.find(".content").show();
        callback();
      } else {
        $module.find(".content").slideToggle(callback);
      }

    }
    if(reload_entries) {
      $module.loadingImage();
    }
    var url = $(this).attr('href');
    $.ajaxJSON(url, 'POST', {collapse: collapse}, data => {
        if(reload_entries) {
          $module.loadingImage('remove');
          for(var idx in data) {
            modules.addItemToModule($module, data[idx].content_tag);
          }
          $module.find(".context_module_items.ui-sortable").sortable('refresh');
          toggle();
          modules.updateProgressionState($module);
        }
    }, data => {
      $module.loadingImage('remove');
    });
    if(collapse == '1' || !reload_entries) {
      toggle();
    }
  }

  // THAT IS THE END

  $(document).ready(function() {
   $('.context_module').each(function() {
     refreshDuplicateLinkStatus($(this));
   });
   if (ENV.IS_STUDENT) {
      $('.context_module').addClass('student-view');
      $('.context_module_item .ig-row').addClass('student-view');
    }

    $('.external_url_link').click(function(event) {
      Helper.externalUrlLinkClick(event, $(this))
    });

    $(".datetime_field").datetime_field();

    $(".context_module").live('mouseover', function() {
      $(".context_module_hover").removeClass('context_module_hover');
      $(this).addClass('context_module_hover');
    });

    $(".context_module_item").live('mouseover focus', function() {
      $(".context_module_item_hover").removeClass('context_module_item_hover');
      $(this).addClass('context_module_item_hover');
    })

    $('.context_module_item').each((i, $item) => {
      modules.evaluateItemCyoe($item)
    });

    var $currentElem = null;
    var hover = function($elem) {

      if($elem.hasClass('context_module')) {
        $(".context_module_hover").removeClass('context_module_hover');
        $(".context_module_item_hover").removeClass('context_module_item_hover');
        $elem.addClass('context_module_hover');
      } else if($elem.hasClass('context_module_item')) {
        $(".context_module_item_hover").removeClass('context_module_item_hover');
        $(".context_module_hover").removeClass('context_module_hover');
        $elem.addClass('context_module_item_hover');
        $elem.parents(".context_module").addClass('context_module_hover');
      }
      $elem.find(":tabbable:first").focus();
    };

    // This method will select the items passed in with the options object
    // and can be used to advance the focus or return to the previous module or module_item
    // This will also return the element that is now in focus
    var selectItem = function (options) {
      options = options || {};
      var $elem;

      if (!$currentElem) {
        $elem = $('.context_module:first');
      } else if($currentElem && $currentElem.hasClass('context_module')) {
        $elem = options.selectWhenModuleFocused && options.selectWhenModuleFocused.item;
        $elem = $elem.length ? $elem : (options.selectWhenModuleFocused && options.selectWhenModuleFocused.fallbackModule);
      } else if ($currentElem && $currentElem.hasClass('context_module_item')) {
        $elem = options.selectWhenModuleItemFocused && options.selectWhenModuleItemFocused.item;
        $elem = $elem.length ? $elem : (options.selectWhenModuleItemFocused && options.selectWhenModuleItemFocused.fallbackModule);
      }

      hover($elem);
      return $elem;
    };

    var getClosestModuleOrItem = function ($currentElem) {
      var selector = $currentElem && $currentElem.closest('.context_module_item_hover').length ? '.context_module_item_hover' : '.context_module_hover';
      return $currentElem.closest(selector);
    };

    // Keyboard Shortcuts:
    // "k" and "up arrow" move the focus up between modules and module items
    var $document = $(document);
    $document.keycodes('k up', event => {
      var params = {
                    selectWhenModuleFocused: {
                      item: $currentElem && $currentElem.prev(".context_module").find(".context_module_item:visible:last"),
                      fallbackModule: $currentElem && $currentElem.prev(".context_module")
                    },
                    selectWhenModuleItemFocused: {
                      item: $currentElem && $currentElem.prev(".context_module_item:visible"),
                      fallbackModule: $currentElem && $currentElem.parents(".context_module")
                    }
                  };
      var $elem = selectItem(params);
      if ($elem.length) $currentElem = $elem;

    });

    // "j" and "down arrow" move the focus down between modules and module items
    $document.keycodes('j down', event => {
       var params = {
                    selectWhenModuleFocused: {
                      item: $currentElem && $currentElem.find(".context_module_item:visible:first"),
                      fallbackModule: $currentElem && $currentElem.next(".context_module")
                    },
                    selectWhenModuleItemFocused: {
                      item: $currentElem && $currentElem.next(".context_module_item:visible"),
                      fallbackModule: $currentElem && $currentElem.parents(".context_module").next(".context_module")
                    }
                  };
      var $elem = selectItem(params);
      if ($elem.length) $currentElem = $elem;

    });

    // "e" opens up Edit Module Settings form if focus is on Module or Edit Item Details form if focused on Module Item
    // "d" deletes module or module item
    // "space" opens up Move Item or Move Module form depending on which item is focused
    $document.keycodes('e d space', event => {
      if (!$currentElem) return;

      var $elem = getClosestModuleOrItem($currentElem);
      var $hasClassItemHover = $elem.hasClass('context_module_item_hover');

      if(event.keyString == 'e') {
        $hasClassItemHover ? $currentElem.find(".edit_item_link:first").click() : $currentElem.find(".edit_module_link:first").click();
      } else if(event.keyString == 'd') {
        if ($hasClassItemHover) {
          $currentElem.find(".delete_item_link:first").click();
          $currentElem = $currentElem.parents('.context_module');
        } else {
          $currentElem.find(".delete_module_link:first").click();
          $currentElem = null;
        }
      } else if(event.keyString == 'space') {
        $hasClassItemHover ? $currentElem.find(".move_module_item_link:first").click() : $currentElem.find(".move_module_link:first").click();
      }

      event.preventDefault();

    });

    // "n" opens up the Add Module form
    $document.keycodes('n', event => {
      $(".add_module_link:visible:first").click();
      event.preventDefault();
    });

    // "i" indents module item
    // "o" outdents module item
    $document.keycodes('i o', event => {
      if (!$currentElem) return;

      var $currentElemID = $currentElem.attr('id');

      if (event.keyString == 'i') {
        $currentElem.find(".indent_item_link:first").trigger("click", [$currentElem, document.activeElement]);
      } else if (event.keyString == 'o') {
        $currentElem.find(".outdent_item_link:first").trigger("click", [$currentElem, document.activeElement]);
      }

      $document.ajaxStop(() => {
        $currentElem = $('#' + $currentElemID);
      });
    });

    if($("#context_modules").hasClass('editable')) {
      requestAnimationFrame(modules.initModuleManagement);
      modules.loadMasterCourseData();
    }

    function moduleContentIsHidden(contentEl) {
      return (contentEl.style.display === 'none') || contentEl.parentElement.classList.contains('collapsed_module')
    }

    // need the assignment data to check past due state
    modules.updateAssignmentData(() => {
      modules.updateProgressions(function afterUpdateProgressions() {
        if (window.location.hash && !window.location.hash.startsWith('#!')) {
          try {
            scrollTo($(window.location.hash))
          } catch (error) {}
        } else {
          const firstContextModuleContent = document.querySelector('.context_module')?.querySelector('.content')
          if (!firstContextModuleContent || moduleContentIsHidden(firstContextModuleContent)) {
            const firstVisibleModuleContent = [...document.querySelectorAll('.context_module .content')].find(el => !moduleContentIsHidden(el))
            if (firstVisibleModuleContent) scrollTo($(firstVisibleModuleContent).parents(".context_module"))
          }
        }
      });
    });

    $(".context_module").find(".expand_module_link,.collapse_module_link").bind('click keyclick', toggleModuleCollapse);
    $(document).fragmentChange((event, hash) => {
      if (hash == '#student_progressions') {
        $(".module_progressions_link").trigger('click');
      } else if (!hash.startsWith('#!')) {
        var module = $(hash.replace(/module/, "context_module"));
        if (module.hasClass('collapsed_module')) {
          module.find(".expand_module_link").triggerHandler('click');
        }
      }
    });

    // from context_modules/_content
    var foundExpanded = false;
    var collapsedModules = ENV.COLLAPSED_MODULES;
    for(var idx in collapsedModules) {
      $("#context_module_" + collapsedModules[idx]).addClass('collapsed_module');
    }

    var $contextModules = $("#context_modules .context_module");
    if (!$contextModules.length) {
      $('#no_context_modules_message').show();
      $('#context_modules_sortable_container').addClass('item-group-container--is-empty');
    }
    $contextModules.each(function() {
      modules.updateProgressionState($(this));
    });
  });

export default modules;

$(function() {
    var current_page = 0;

    var refresh_pull_requests = function() {
        $( ".pagination" ).hide();
        $( "#pull_requests" ).fadeOut( "fast", function() {
            $( "#pull_request_loading" ).fadeIn( "fast", function() {
                $.ajax({
                    url: "/pulls",
                    data: {
                        page: current_page
                    },
                    success: function( data ) {
                        $( "#pull_request_loading" ).fadeOut( "fast", function() {
                            $( "#pull_requests" ).html( data.pulls ).show();
                            $( ".pagination li.next" ).toggleClass( "disabled", !data.has_next_page );
                            if ( $( ".pagination li.disabled" ).length !== 2 ) {
                                $( ".pagination" ).show();
                            }
                            $( "#main" ).fadeIn( "fast" );
                        });
                    }
                });
            });
        });
    };

    var refresh_sidebar = function ( data ) {
        $( "div.sidebar" ).html( data.html ).find( ".new" ).fadeIn( "slow" );
        $( "pre.modified" ).html( $( "div.sidebar" ).find( ".modified" ).html() );
        if (!data.clean) {
            $( ".pull_request_actions button:not(.closebtn)" ).attr( "disabled", "disabled" );
            $( ".pull_request_actions button.closebtn" ).removeAttr( "disabled" );
            $( "#force_warning" ).html( data.force_html );
        } else {
            $( ".pull_request_actions button:disabled" ).removeAttr( "disabled" );
        }
    };

    var do_reset = function( force ) {
        $( ".modal_actions button:not(.closebtn)" ).attr("disabled", "disabled");
        var params = {
            force: force || false
        };
        $.ajax({
            url: "/reset",
            data: params,
            success: function( data ) {
                refresh_sidebar( data );
                if ( force ) {
                    $( "#force_warning" ).modal( "hide" );
                    $( ".modal_actions button:not(.closebtn)" ).removeAttr("disabled");
                    $( ".pull_request_actions button:disabled" ).removeAttr("disabled");
                }
            }
        });
    };

    var setup_validation_dialog = function( issue, title, url ) {
        $( ".merge_step" ).hide();
        $( "#validate-issue a" ).text( "#" + issue ).attr( "href", url );
        $( "#validate_in_progress" ).show();
        $( "#validation_actions button.cancelbtn" ).removeAttr( "disabled" ).show();
        $( "#validate" ).modal( "show" );
    };

    var validation_progress = function( step, data ) {
        switch ( step ) {
            case 1:
                $( "#validate_in_progress" ).fadeOut( "fast", function() {
                    // Show the rendered pull request html
                    $( "#validate_merge_options" ).html( data.pr_html );
                    // data.success indicates if there is a conflict or not
                    if ( data.success ) {
                        $( "#validate_merge_options .merge_step_one" ).show();
                        $( "#validation_actions .merge_step_one" ).fadeIn( "fast" );
                    } else {
                        $( "#validate_merge_options .merge_conflict" ).show();
                        $( "#validation_actions button.cancelbtn" ).fadeOut( "fast" , function( e ){
                            $( "#validation_actions .merge_conflict" ).fadeIn( "fast" );                            
                        });
                    }
                    $( "#validate_merge_options" ).fadeIn( "fast" );
                    refresh_sidebar( data.sidebar );
                });
                break;
            case 2:
                $( ".merge_step_one" ).fadeOut( "fast", function() {
                    $( ".merge_step_two" ).fadeIn( "fast" );
                });
                break;
            case 3:
                $( ".merge_step_two" ).fadeOut( "fast", function() {
                    $( ".merge_step_three_squash" ).fadeIn( "fast" );
                });
                break;
            default:
                break;
        }
    };

    var do_validation = function( issue, title, url ) {
        setup_validation_dialog( issue, title, url );
        $.ajax({
            url: "/validate/" + issue,
            type: "GET",
            success: function( data ) {
                validation_progress( 1, data );
            }
        });
    };

    var prepare_merge = function( issue, title, url ) {
        // Do a little clone magic to put the loading indicator into the modal
        var $modal_loading = $( "#modal_loading ").clone().attr("id", "modal_loading" + (100000*Math.random()));
        $modal_loading.find( ".modal-header h3" ).text( "Merging " + title );
        $( "#merge" ).html( $modal_loading.show() );
        $( "#merge" ).modal( "show" );

        $.ajax({
            url: "/merge/" + issue,
            success: function( data ) {
                // Chunk the data to more easily manipulate the DOM
                var $merge_html = $( "<div/>" ).html( data );
                var body = $merge_html.find( ".modal-body" ).html();
                var footer = $merge_html.find( ".modal-footer" ).html();
                $( "#merge .modal-body, #merge .modal-footer" ).fadeOut("fast", function() {
                    $( "#merge .modal-body" ).html( body ).fadeIn( "fast" );
                    $( "#merge .modal-footer" ).html( footer ).fadeIn( "fast" );
                });
            }
        });
    };

    var do_merge = function( issue, type, author ) {
        $( ".modal_actions button:not(.closebtn)" ).attr("disabled", "disabled");
        var params = {
            message: get_merge_message()
        };
        if (author) {
            params.author = $.trim(author);
        }
        var url = "/merge/" + type + "/" + issue;
        $.ajax({
            url: url,
            type: "POST",
            data: params,
            success: function( data ) {
                finish_merge( data, issue );
            }
        });
    };

    var finish_merge = function( data, issue ) {
        var $modal = $( ".modal:visible" );
        if ( data.success ) {
            $modal.off( "hidden" ).on( "hidden", function() {
                $( "div[data-issue='" + issue + "']" ).fadeOut( "slow" );
                $( ".modal_actions button:disabled" ).removeAttr( "disabled" );
            });
            $modal.modal( "hide" );
        } else {
            // Merge failed
            $modal.modal( "hide" );
        }
    };

    var get_merge_message = function() {
        var header = $( "#merge_message_header:visible" ).text();
        var body = $( "#merge_message:visible" ).val();
        return header + "\n\n" + body;
    };

    var add_bindings = function() {

        $( "#validate, #force_warning, #merge" ).modal({
            backdrop: true
        });

        $( ".modal ").on( "click", "button.closebtn", function( e ) {
            $( this ).parents( ".modal" ).modal( "hide" );
        });

        $( "div.content" ).on( "click", "button[data-issue]", function( e ) {
            var action = $( this ).attr( "data-action" );
            switch ( action ) {
                case "validate":
                    do_validation( $( this ).attr( "data-issue" ), $( this ).attr( "data-title" ), $( this ).attr( "data-github-url" ) );
                    break;
                case "merge":
                    prepare_merge( $( this ).attr( "data-issue" ), $( this ).attr( "data-title" ), $( this ).attr( "data-github-url" ) );
                    break;
                default:
                    break;
            }
        });

        $( "div.content" ).on( "click", "button#refresh_pulls", function( e ) {
            current_page = 0;
            refresh_pull_requests();
        });

        $( "div.sidebar" ).on( "click", "button#refresh", function( e ) {
            $.ajax({
                url: "/sidebar",
                success: function( data ) {
                    refresh_sidebar( data );
                }
            });
        });

        $( "div.sidebar" ).on( "click", "button.reset", function( e ) {
            if ( $( this ).attr( "data-harshness" ) ) {
                $( "#force_warning" ).modal( "show" );
            } else {
                do_reset();
            }
        });

        $( "div#force_warning" ).on( "click", "button", function( e ) {
            if ( $( this ).attr( "data-action" ) === "continue" ) {
                do_reset( true );
            } else {
                $( "#force_warning" ).modal( "hide" );
            }
        });

        $( "#validate" ).on( "click", ".merge_step_one button", function( e ) {
            if ( $( this ).attr( "data-continue" ) ) {
                validation_progress( 2 );
            } else {
                $( "#validate" ).modal( "hide" );
            }
        });

        $( "#validate" ).on( "click", ".merge_step_two button", function( e ) {
            var issue = $( ".merge_validation:visible" ).attr( "data-issue" );
            if ( $( this ).attr( "data-merge-type" ) === "squash" ) {
                validation_progress( 3 );
            } else {
                do_merge( issue, "merge", false );
            }
        });

        $( "#validate" ).on( "click", ".merge_step_three_commit_authors tr", function( e ) {
            if ( !$( this ).hasClass( "selected" ) ) {
                $( ".merge_step_three_commit_authors tr.selected" ).removeClass( "selected" );
            }
            $( this ).toggleClass( "selected" );
            if ( $( ".merge_step_three_commit_authors tr.selected" ).length ) {
                $( ".merge_step_three_squash button:disabled" ).removeAttr( "disabled" );
            } else {
                $( ".merge_step_three_squash button:not(.closebtn)" ).attr( "disabled", "disabled" );
            }
        });

        $( ".merge_step_three_squash" ).on( "click", "button", function( e ) {
            do_merge( $( ".merge_validation:visible" ).attr( "data-issue" ), "squash", $( ".merge_step_three_commit_authors tr.selected td" ).text() );
        });

        $( "#merge" ).on( "click", "button[data-action='merge']", function( e ) {
            do_merge( $( this ).attr( "data-issue"), "merge", false );
        });

        $( ".pagination" ).on( "click", "li a", function( e ) {
            if ( !$( this ).parent( "li" ).hasClass( "disabled" ) ) {
                var direction = $( this ).parent( "li" ).hasClass( "prev" ) ? -1 : 1;
                current_page += direction;
                refresh_pull_requests();
                if ( current_page === 0 ) {
                    $( ".pagination li.prev" ).addClass( "disabled" );
                } else {
                    $( ".pagination li.disabled" ).removeClass( "disabled" );
                }
            }
            e.preventDefault();
        });
    };

    var init = function() {
        add_bindings();
        refresh_pull_requests();
    };

    init();
});

from models import StudentIntake, NewStudentApplication
from forms import StudentIntakeForm
from django.contrib import admin

from django.forms import ModelForm, Textarea


class StudentIntakeAdmin(admin.ModelAdmin):
    list_display = ['name', 'email_address', 'instructor_name']
    fieldsets = ((None, {
            'fields': ('name', 'email_address', 'instructor_name', 'git_hub')
        }),
        ('Advanced options', {
            'classes': ('wide',),
            'fields': ('student_bio', 'student_goals')
        }),
    )

admin.site.register(StudentIntake, StudentIntakeAdmin)
admin.site.register(NewStudentApplication)